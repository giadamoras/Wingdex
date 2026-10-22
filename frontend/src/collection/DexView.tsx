import { useState } from 'react'
import {
  AIRCRAFT_FAMILIES,
  AIRCRAFT_TYPES,
  type AircraftCategory,
} from '../shared-lib/aircraftTypes'
import { AIRLINES, type AirlineKind } from '../shared-lib/airlines'
import { COUNTRY_NAMES } from '../shared-lib/countries'
import { navigate, pick, useFullPath } from '../shared-lib/usePath'
import { PlaneIcon } from '../map/PlaneIcon'
import { Flag } from '../shared-ui/Flag'
import { DetailDialog } from '../shared-ui/DetailDialog'
import {
  otherTypes,
  questStreak,
  seenAirlines,
  seenCountries,
  seenTypes,
  tileType,
} from './dex'
import type { JournalEntry } from '../data/types'

// Display order and names of the catalog's categories and airline kinds.
const CATEGORIES: [AircraftCategory, string][] = [
  ['narrowBody', 'Narrow-body'],
  ['wideBody', 'Wide-body'],
  ['regionalJet', 'Regional jets'],
  ['turboprop', 'Turboprops'],
  ['bizJet', 'Business jets'],
  ['light', 'Light aircraft'],
  ['helicopter', 'Helicopters'],
  ['glider', 'Gliders'],
]
const KINDS: [AirlineKind, string][] = [
  ['fullService', 'Full-service'],
  ['lowCost', 'Low-cost'],
  ['leisure', 'Holiday'],
  ['regional', 'Regional'],
  ['cargo', 'Cargo'],
]
const CATEGORY_IDS = CATEGORIES.map(([c]) => c)
const KIND_IDS = KINDS.map(([k]) => k)
const SECTIONS = ['aircraft', 'airlines', 'passport'] as const
type Section = (typeof SECTIONS)[number]

const TYPE_CODES = Object.keys(AIRCRAFT_TYPES)
const AIRLINE_CODES = Object.keys(AIRLINES)
const FAMILY_COUNT = Object.keys(AIRCRAFT_FAMILIES).length

// One tile in the aircraft grid: a family, or all of a category's types that
// have no family ("Other light aircraft"), so lone types don't flood the grid.
interface Group {
  id: string
  name: string
  codes: string[]
}

// A category's groups, in catalog order, the family-less one last.
function groupsOf(category: AircraftCategory, label: string): Group[] {
  const families = new Map<string, Group>()
  const lone: string[] = []
  for (const code of TYPE_CODES) {
    const type = AIRCRAFT_TYPES[code]
    if (type.category !== category) continue
    if (!type.family) {
      lone.push(code)
      continue
    }
    const group = families.get(type.family) ?? {
      id: type.family,
      name: AIRCRAFT_FAMILIES[type.family].name,
      codes: [],
    }
    group.codes.push(code)
    families.set(type.family, group)
  }
  const groups = [...families.values()]
  if (lone.length > 0) {
    // "Other gliders" reads oddly when there's nothing else in the category.
    const name = groups.length > 0 ? `Other ${label.toLowerCase()}` : label
    groups.push({ id: `other-${category}`, name, codes: lone })
  }
  return groups
}

const GROUPS = Object.fromEntries(
  CATEGORIES.map(([category, label]) => [category, groupsOf(category, label)]),
) as Record<AircraftCategory, Group[]>

const count = (codes: string[], seen: Set<string>) =>
  codes.filter((c) => seen.has(c)).length

// Up to this many types, a tile shows one dot per type; above it, "3/23".
const MAX_DOTS = 8

// A row of filter chips, one group shown at a time, each with its count.
function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; have: number; total: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="dex-chips">
      {options.map((o) => (
        <button
          key={o.id}
          className={o.id === value ? 'dex-chip active' : 'dex-chip'}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}{' '}
          <span className="dex-chip-count">
            {o.have}/{o.total}
          </span>
        </button>
      ))}
    </div>
  )
}

// An airline's tail fin, the part of a plane that carries its livery, with
// its ICAO code on it; an ink shadow with "?" for the ones still to find.
function TailFin({ code }: { code: string | null }) {
  return (
    <svg
      className={code ? 'tail-fin' : 'tail-fin missing'}
      viewBox="0 0 48 44"
      aria-hidden="true"
    >
      {/* Swept leading edge up to a short top, near-upright trailing edge. */}
      <path className="tail-fin-fin" d="M3 38 L27 4 H38 L44 38 Z" />
      {/* The top of the fuselage the fin sits on. */}
      <path
        className="tail-fin-body"
        d="M0 37 H48 V41 Q48 43 46 43 H2 Q0 43 0 41 Z"
      />
      <text x="29" y="30" textAnchor="middle">
        {code ?? '?'}
      </text>
    </svg>
  )
}

// A "+N to find" shadow tile closing a grid, in place of listing every
// unseen name.
function ToFind({ missing }: { missing: number }) {
  return missing > 0 ? (
    <span className="dex-tile-name">{`+${missing} to find`}</span>
  ) : null
}

// The aircraft grid for one category: a tile per family, in colour once a
// type of it is caught, an ink shadow before. Tapping one opens its types.
function AircraftSection({
  category,
  types,
  recent,
  onChip,
  onOpen,
}: {
  category: AircraftCategory
  types: Set<string>
  recent: (string | null)[] // the Journal's type codes, newest first
  onChip: (category: AircraftCategory) => void
  onOpen: (group: Group) => void
}) {
  return (
    <>
      <Chips
        options={CATEGORIES.map(([id, label]) => ({
          id,
          label,
          have: GROUPS[id].filter((g) => count(g.codes, types) > 0).length,
          total: GROUPS[id].length,
        }))}
        value={category}
        onChange={onChip}
      />
      <ul className="dex-tiles">
        {GROUPS[category].map((group) => {
          const caught = count(group.codes, types)
          return (
            <li key={group.id}>
              <button
                className={caught > 0 ? 'dex-tile seen' : 'dex-tile'}
                aria-haspopup="dialog"
                onClick={() => onOpen(group)}
              >
                <PlaneIcon
                  heading={0}
                  aircraftType={tileType(group.codes, recent)}
                />
                <span className="dex-tile-name">{group.name}</span>
                {group.codes.length <= MAX_DOTS ? (
                  <span className="dex-dots" aria-hidden="true">
                    {group.codes.map((c) => (
                      <span
                        key={c}
                        className={types.has(c) ? 'on' : undefined}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="dex-tile-count" aria-hidden="true">
                    {caught}/{group.codes.length}
                  </span>
                )}
                <span className="visually-hidden">
                  {`, ${caught} of ${group.codes.length} types caught`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// The airlines of one kind: a tail fin per caught airline, then one shadow
// fin for how many are left.
function AirlinesSection({
  kind,
  airlines,
  onChip,
}: {
  kind: AirlineKind
  airlines: Set<string>
  onChip: (kind: AirlineKind) => void
}) {
  const ofKind = (k: AirlineKind) =>
    AIRLINE_CODES.filter((c) => AIRLINES[c].kind === k)
  const codes = ofKind(kind)
  const caught = codes.filter((c) => airlines.has(c))
  return (
    <>
      <Chips
        options={KINDS.map(([id, label]) => ({
          id,
          label,
          have: count(ofKind(id), airlines),
          total: ofKind(id).length,
        }))}
        value={kind}
        onChange={onChip}
      />
      <ul className="dex-tiles">
        {caught.map((code) => (
          <li key={code} className="dex-card">
            <TailFin code={code} />
            <span className="dex-tile-name">{AIRLINES[code].name}</span>
          </li>
        ))}
        {codes.length > caught.length && (
          <li className="dex-card missing">
            <TailFin code={null} />
            <ToFind missing={codes.length - caught.length} />
          </li>
        )}
      </ul>
    </>
  )
}

// The collect-them-all view: one collection at a time, picked from a
// segmented switch, then narrowed by chips. Caught things are drawn in
// colour, the rest as shadows. The section and chip are the URL's last parts
// ("/collection/dex/airlines/lowCost"), so a reload keeps them; the URL is
// always filled in with the defaults (the first chip of a section).
export function DexView({
  journal,
  path,
}: {
  journal: JournalEntry[]
  path: string[] // [section, chip], either may be missing
}) {
  const [openGroup, setOpenGroup] = useState<Group | null>(null)
  const section = pick(path, 0, SECTIONS)
  const category = pick(path, 1, CATEGORY_IDS)
  const kind = pick(path, 1, KIND_IDS)
  const chip =
    section === 'aircraft' ? category : section === 'airlines' ? kind : null
  useFullPath(
    ['collection', 'dex', ...path],
    ['collection', 'dex', section, ...(chip ? [chip] : [])],
  )
  const go = (next: string[]) =>
    navigate(['collection', 'dex', ...next], { replace: true })

  const types = seenTypes(journal)
  const recent = journal.map((e) => e.flight.aircraft_type).reverse()
  const airlines = seenAirlines(journal)
  const countries = seenCountries(journal)
  const others = otherTypes(journal)
  const streak = questStreak(journal)
  const families = new Set(
    [...types].flatMap((c) => AIRCRAFT_TYPES[c]?.family ?? []),
  )
  const typeCount = count(TYPE_CODES, types)

  const totals: Record<Section, [number, number, string]> = {
    aircraft: [typeCount, TYPE_CODES.length, 'types'],
    airlines: [airlines.size, AIRLINE_CODES.length, 'airlines'],
    passport: [countries.size, COUNTRY_NAMES.length, 'countries'],
  }
  const [have, total, unit] = totals[section]

  return (
    <section className="dex">
      <div className="dex-top">
        <div className="dex-switch">
          {SECTIONS.map((s) => (
            <button
              key={s}
              className={s === section ? 'active' : undefined}
              aria-pressed={s === section}
              onClick={() => go([s])}
            >
              {s === 'aircraft'
                ? 'Aircraft'
                : s === 'airlines'
                  ? 'Airlines'
                  : 'Passport'}
            </button>
          ))}
        </div>
        <div className="dex-pills">
          {/* The streak's only home: the map's quest strip stays about today.
              Each shows only once there is something to count: no "0-day
              streak" for a new player. */}
          {streak.current > 0 && (
            <span className="pill streak">
              <span aria-hidden="true">🔥</span> {streak.current}-day streak
            </span>
          )}
          {streak.best > 0 && (
            <span className="pill">
              <span aria-hidden="true">🏆</span> Best: {streak.best}-day streak
            </span>
          )}
        </div>
      </div>

      <div className="dex-progress">
        <p>
          <strong>{have}</strong> of {total} {unit}
          {section === 'aircraft' &&
            ` · ${families.size} of ${FAMILY_COUNT} families`}
        </p>
        <span className="dex-bar" aria-hidden="true">
          <span style={{ width: `${(100 * have) / total}%` }} />
        </span>
      </div>

      {section === 'aircraft' && (
        <AircraftSection
          category={category}
          types={types}
          recent={recent}
          onChip={(c) => go(['aircraft', c])}
          onOpen={setOpenGroup}
        />
      )}
      {section === 'aircraft' && others.length > 0 && (
        <p className="dex-note">
          Also caught, not in the catalog yet: {others.join(', ')}
        </p>
      )}
      {section === 'airlines' && (
        <AirlinesSection
          kind={kind}
          airlines={airlines}
          onChip={(k) => go(['airlines', k])}
        />
      )}

      {section === 'passport' && (
        <ul className="dex-tiles">
          {[...countries].map((country) => (
            <li key={country} className="dex-card">
              <Flag country={country} />
              <span className="dex-tile-name">{country}</span>
            </li>
          ))}
          <li className="dex-card missing">
            <span className="flag-missing" aria-hidden="true">
              ?
            </span>
            <ToFind missing={COUNTRY_NAMES.length - countries.size} />
          </li>
        </ul>
      )}

      {openGroup && (
        <DetailDialog
          key={openGroup.id}
          icon={
            <PlaneIcon
              heading={0}
              aircraftType={tileType(openGroup.codes, recent)}
            />
          }
          title={openGroup.name}
          onClose={() => setOpenGroup(null)}
        >
          <ul className="detail-dialog-list">
            {openGroup.codes.map((c) => (
              <li key={c} className={types.has(c) ? 'seen' : undefined}>
                {/* Its own column, so caught and uncaught names line up. */}
                <span className="detail-dialog-mark" aria-hidden="true">
                  {types.has(c) ? '✓' : ''}
                </span>
                {AIRCRAFT_TYPES[c].name}
                {!types.has(c) && (
                  <span className="visually-hidden"> (not caught yet)</span>
                )}
              </li>
            ))}
          </ul>
        </DetailDialog>
      )}
    </section>
  )
}
