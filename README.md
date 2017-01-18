# flowx
JSON based flow generator

## Usage

### Basic
```javascript
'use strict'

const Flowx = require('flowx')

const data = {
  flow: "test1",
  states: [
    {
      name: "state1",
      transitions: [
        {
          name: "toState2",
          to: "state2"
        }
      ]
    },
    {
      name: "state2",
      transitions: [
        {
          name: "toState1",
          to: "state1"
        }
      ]
    }
  ]
}

const flow = new Flowx.Flow('myflow', data)

const instance = flow.newInstance(1)

instance.getState().then(function(state){
  console.log('State: ' + JSON.stringify(state.name))
})

instance.getState({action: 'toState2'}).then(function(state){
  console.log('State: ' + JSON.stringify(state.name))
})
```