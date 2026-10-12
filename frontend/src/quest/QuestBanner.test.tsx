import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { Quest } from './quest'
import { QuestBanner } from './QuestBanner'

afterEach(cleanup)

const quest: Quest = {
  id: 'q1',
  title: 'Catch a long-haul flight',
  conceptFact: 'Long flights fly high.',
  matches: () => true,
}

const banner = (props: Partial<Parameters<typeof QuestBanner>[0]> = {}) =>
  render(
    <QuestBanner
      quest={quest}
      done={false}
      searching={false}
      feedDown={false}
      {...props}
    />,
  )

test('shows the quest title as a heading, with no stamp or fact yet', () => {
  banner()
  expect(
    screen.getByRole('heading', { level: 2, name: quest.title }),
  ).toBeTruthy()
  expect(screen.queryByText('Done!')).toBeNull()
  expect(screen.queryByText(quest.conceptFact)).toBeNull()
})

test('a completed quest shows the stamp and the concept fact', () => {
  banner({ done: true })
  expect(screen.getByText('Done!')).toBeTruthy()
  expect(screen.getByText(quest.conceptFact)).toBeTruthy()
})

test('without a quest, the text says why', () => {
  const { unmount } = banner({ quest: null, searching: true })
  expect(screen.getByText("Finding today's quest...")).toBeTruthy()
  unmount()

  const down = banner({ quest: null, searching: true, feedDown: true })
  expect(screen.getByText(/once flights load/)).toBeTruthy()
  expect(screen.queryByText("Finding today's quest...")).toBeNull()
  down.unmount()

  banner({ quest: null }) // loaded, but nothing in the feed fits a quest
  expect(screen.getByText(/rest day/)).toBeTruthy()
})
