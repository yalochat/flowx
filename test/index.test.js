const nock = require('nock')

const Flowx = require('../')
const Util = require('../lib/utils')

const data = require('./fixtures/flow.json')

const preparedData = Util.prepareModel(data).states.toJS()
const watchdogBaseUri = process.env.WATCHDOG_BASE_URI

let instance

const fakeRequestWatchdog = () => {
  nock(watchdogBaseUri)
    .post('/domains/myFlow/intents/search')
    .query({ numIntents: 3 })
    .reply(200, {
      domain: 'test',
      results: [
        {
          classificationId: 3524063,
          entities: [],
          id: 4,
          intents: [
            {
              category: 'buy-ticket',
              categoryDescription: 'Flight ticket sellings',
              confidence: 0.6926555037498474,
            },
            {
              category: 'promo',
              categoryDescription: 'Promotions',
              confidence: 0.26473885774612427,
            },
          ],
        },
      ],
    })
}

beforeEach(() => (Flowx.new()
  .then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test',
    }
    return flow.getInstance(key)
      .then((bot) => {
        instance = { flow, bot }
      })
  })
))

test('Get current state without action', () => {
  const { flow, bot } = instance
  return flow.getState(bot, {}).then((state) => {
    expect(state.state).toEqual(preparedData[0])
  })
})

test('Get state with action', () => {
  const { flow, bot } = instance
  return flow.getState(bot, { action: 'toState2' }).then((state) => {
    expect(state.state).toEqual(preparedData[1])
  })
})

test('Get state with action regExp', () => {
  const { flow, bot } = instance
  return flow.getState(bot, { action: '3' }).then((state) => {
    expect(state.state).toEqual(preparedData[2])
  })
})

test('Get state with action wildcard', () => {
  const { flow, bot } = instance
  return flow.getState(bot, { action: 'abc' }).then((state) => {
    expect(state.state).toEqual(preparedData[0])
  })
})

test('Get global state', () => {
  const { flow, bot } = instance
  return flow.getState(bot, { action: 'globalState' }).then((state) => {
    expect(state.state).toEqual(preparedData[3])
  })
})

test('Get default state', () => {
  const { flow, bot } = instance
  return flow.getState(bot, { action: 'test' }).then((state) => {
    expect(state.state).toEqual(preparedData[4])
  })
})

test('Get state using global transition', () => {
  const { flow, bot } = instance
  return flow.getState(bot, { action: 'toState1' }).then((state) => {
    expect(state.state).toEqual(preparedData[0])
  })
})

test('Get state via transition with confidence but not marked as watchdog', () => {
  fakeRequestWatchdog()
  const { flow, bot } = instance
  const actions = [
    {
      type: 'user',
      value: 'toState3',
    },
  ]
  return flow.getState(bot, { action: actions }).then((state) => {
    expect(state.state).toEqual(preparedData[2])
  })
})

test('Get state with actions array with type without confidence and without type', () => {
  const { flow, bot } = instance
  const actions = [
    {
      value: '*',
    },
  ]
  return flow.getState(bot, { action: actions }).then((state) => {
    expect(state.state).toEqual(preparedData[0])
  })
})

test('Get state with a watchdog transition', () => {
  fakeRequestWatchdog()
  const { flow, bot } = instance
  const actions = [
    {
      value: 'I want to buy a flight ticket',
    },
  ]

  return flow.getState(bot, { action: actions })
    .then((state) => {
      expect(state.state).toEqual(preparedData[7])
    })
})
