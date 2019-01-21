'use strict'

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

test('Get current state without action', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      return flow.getState(bot, {}).then((state) => {
        expect(state.state).toEqual(preparedData[0])
      })
    })
  })
})

test('Get state with action', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      return flow.getState(bot, { action: 'toState2' }).then((state) => {
        expect(state.state).toEqual(preparedData[1])
      })
    })
  })
})

test('Get state with action regExp', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      return flow.getState(bot, { action: '3' }).then((state) => {
        expect(state.state).toEqual(preparedData[2])
      })
    })
  })
})

test('Get state with action wildcard', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      return flow.getState(bot, { action: 'abc' }).then((state) => {
        expect(state.state).toEqual(preparedData[0])
      })
    })
  })
})

test.skip('Get global state', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      console.log('bot: %j', bot)
      return flow.getState(bot, { action: 'globalState' }).then((state) => {
        expect(state.state).toEqual(preparedData[3])
      })
    })
  })
})

test('Get default state', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      return flow.getState(bot, { action: 'test' }).then((state) => {
        expect(state.state).toEqual(preparedData[4])
      })
    })
  })
})

test('Get state using global transition', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      return flow.getState(bot, { action: 'toState1' }).then((state) => {
        expect(state.state).toEqual(preparedData[0])
      })
    })
  })
})

test('Get state with confidence', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      const actions = [
        {
          type: 'test',
          value: 'toState3',
          confidence: 0.6
        }
      ]
      return flow.getState(bot, { action: actions }).then((state) => {
        expect(state.state).toEqual(preparedData[2])
      })
    })
  })
})

test('Get state with actions array without type', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      const actions = [
        {
          value: 'toState2'
        }
      ]
      return flow.getState(bot, { action: actions }).then((state) => {
        expect(state.state).toEqual(preparedData[1])
      })
    })
  })
})

test('Get state with actions array with type without confidence', () => {
  return Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    return flow.getInstance(key).then((bot) => {
      const actions = [
        {
          value: 'init',
          type: 'user'
        }
      ]
      return flow.getState(bot, { action: actions }).then((state) => {
        expect(state.state).toEqual(preparedData[5])
      })
    })
  })
})