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
      name: 'state1',
      transitions: [
        {
          when: 'toState2',
          to: 'state2'
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
      name: 'state2',
      transitions: [
        {
          when: 'toState1',
          to: 'state1'
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

test('Get current state without action', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, {}).then((state) => {
        expect(state).toEqual(preparedData[0])
        done()
      })
    })
  })
})

test('Get state with action', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, { action: 'toState2' }).then((state) => {
        expect(state).toEqual(preparedData[1])
        done()
      })
    })
  })
})

test('Get state with action regExp', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, { action: '3' }).then((state) => {
        expect(state).toEqual(preparedData[2])
        done()
      })
    })
  })
})

test('Get state with action wildcard', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, { action: 'abc' }).then((state) => {
        expect(state).toEqual(preparedData[0])
        done()
      })
    })
  })
})

test('Get global state', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, { action: 'globalState' }).then((state) => {
        expect(state).toEqual(preparedData[3])
        done()
      })
    })
  })
})

test('Get default state', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, { action: 'test' }).then((state) => {
        expect(state).toEqual(preparedData[4])
        done()
      })
    })
  })
})

test('Get state using global transition', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, { action: 'toState1' }).then((state) => {
        expect(state).toEqual(preparedData[0])
        done()
      })
    })
  })
})

test('Get state with condifence', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      const actions = [
        {
          type: 'test',
          value: 'toState3',
          confidence: 0.6
        }
      ]
      flow.getState(bot, { action: actions }).then((state) => {
        expect(state).toEqual(preparedData[2])
        done()
      })
    })
  })
})

test('Get state with actions array without type', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      const actions = [
        {
          value: 'toState2'
        }
      ]
      flow.getState(bot, { action: actions }).then((state) => {
        expect(state).toEqual(preparedData[1])
        done()
      })
    })
  })
})

test('Get state with actions array with type without confidence', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      const actions = [
        {
          value: 'init',
          type: 'user'
        }
      ]
      flow.getState(bot, { action: actions }).then((state) => {
        expect(state).toEqual(preparedData[5])
        done()
      })
    })
  })
})