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
        }
      ]
    },
    {
      name: 'state3',
      transitions: [
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
    }
  ]
}

const preparedData = Util.prepareModel(data)

test('Get current state without action', (done) => {
  Flowx.new().then((flowxServer) => {
    const flow = new flowxServer.Flow('myFlow', data)
    const key = {
      id: '111',
      segment: 'test'
    }
    flow.getInstance(key).then((bot) => {
      flow.getState(bot, {}).then((state) => {
        expect(state).toEqual(preparedData.states[0])
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
        expect(state).toEqual(preparedData.states[1])
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
        expect(state).toEqual(preparedData.states[2])
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
        expect(state).toEqual(preparedData.states[0])
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
        expect(state).toEqual(preparedData.states[3])
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
        expect(state).toEqual(preparedData.states[4])
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
        expect(state).toEqual(preparedData.states[0])
        done()
      })
    })
  })
})