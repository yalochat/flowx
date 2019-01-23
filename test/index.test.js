// const fx = require('fixtures')
const nock = require('nock')
const sinon = require('sinon')

const Flowx = require('../')
const Util = require('../lib/utils')

const data = {
  flow: 'test1',
  ttl: 10000,
  globalTransitions: [
    {
      when: 'toState1',
      to: 'state1'
    }
  ],
  states: [
    {
      id: 1,
      name: 'state1',
      transitions: [
        {
          when: 'toState2',
          to: 2
        },
        {
          when: 'toState3',
          to: 'state3',
          type: 'test',
          confidence: 0.5
        }
      ]
    },
    {
      id: 2,
      name: 'state2',
      transitions: [
        {
          when: 'toState1',
          to: 1
        },
        {
          when: '/\\d/i',
          to: 'state3'
        },
        {
          when: 'init',
          to: 'state4',
          type: 'user'
        }
      ]
    },
    {
      id: 3,
      name: 'state3',
      transitions: [
        {
          when: 'toState2',
          to: 'state2'
        },
        {
          when: '*',
          to: 'state1'
        }
      ]
    },
    {
      id: 4,
      name: 'globalState',
      global: true,
      transitions: [
        {
          when: 'toState1',
          to: 'state1'
        }
      ]
    },
    {
      id: 6,
      name: 'default',
      globalTransitions: true,
      transitions: [
        {
          when: 'toState2',
          to: 'state2'
        }
      ]
    },
    {
      id: 5,
      name: 'state4',
      transitions: [
        {
          when: 'toState1',
          to: 'state1'
        }
      ]
    }
  ]
}

const preparedData = Util.prepareModel(data).states.toJS()
const watchdogBaseUri = process.env.WATCHDOG_BASE_URI

let instance

const fakeRequestWatchdog = () => {
  nock(watchdogBaseUri)
    .get('/domains/test/intents/search?numIntents=3')
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
              categoryDescription: 'Compra de boleto',
              confidence: 0.6926555037498474,
            },
            {
              category: 'promo',
              categoryDescription: 'Promociones',
              confidence: 0.26473885774612427,
            },
          ],
        },
      ],
    })
}

beforeEach(() => (Flowx.new()
  .then((flowxServer) => {
    // console.log('Flowx server created')
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test',
    }
    return flow.getInstance(key)
      .then((bot) => {
        // console.log('Flowx instance created.')
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

test('Get state with confidence', () => {
  const { flow, bot } = instance
  const actions = [
    {
      type: 'test',
      value: 'toState3',
      confidence: 0.6,
    },
  ]
  return flow.getState(bot, { action: actions }).then((state) => {
    expect(state.state).toEqual(preparedData[2])
  })
})

test('Get state with actions array without type', () => {
  const { flow, bot } = instance
  const actions = [
    {
      value: 'toState2',
    },
  ]
  return flow.getState(bot, { action: actions }).then((state) => {
    expect(state.state).toEqual(preparedData[1])
  })
})

test('Get state with actions array with type without confidence', () => {
  const { flow, bot } = instance
  const actions = [
    {
      value: 'init',
      type: 'user',
    },
  ]
  return flow.getState(bot, { action: actions }).then((state) => {
    expect(state.state).toEqual(preparedData[5])
  })
})

test.skip('Get state with a watchdog transition', () => {
  fakeRequestWatchdog()
  const { flow, bot } = instance
  const actions = [
    {
      value: 'toState2',
    },
  ]

  return flow.getState(bot, { action: actions }).then((state) => {
    expect(state.state).toEqual(preparedData[5])
  })
})
