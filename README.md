# Flowx
JSON based state machine 

## Usage
Basically you create a flow document with this structure:
```json
{
  "flow": "flow-name",
  "states": [
    {
      "name": "state-name",
      "transitions": [
        {
          "when": "<exactMatch|regex|*>",
          "to": "<next-state>"
        },
        ...
      ]
    }
  ]
}
```

Then use it to create a `Flowx.Flow` instance. This new instance will be used to execute change of states based on `actions`

`action`s are values that are evaluated to match with `when` value of a transition. If this matching evaluation is `true` then state machine change the current state to the `to` value provided in the evaluated transition.

## Yalo usage
This fork was modified to be part of the Yalo's `bot-runner` product.

`bot-runner` uses `flowx` to handle a state machine artifact. But, if you check out the code, you can find custom integrations.

One of those custom integrations is the `watchdog` transition.

This type of transition, don't evaluate instantaneously `when` value, but before make a request to watchdog to get intents base on the user's `action`. And it only happens if the transition is of type `watchdog`, otherwise `when` value is used for comparation.



## Try it out
```javascript
const { Flow } = require('flowx')

const plainFlow = {
  flow: "test1",
  states: [
    {
      name: "state1",
      transitions: [
        {
          type: "user",
          when: "toState2",
          to: "state2"
        }
      ]
    },
    {
      name: "state2",
      transitions: [
        {
          type: "user"
          when: "toState1",
          to: "state1"
        }
      ]
    }
  ]
}

const flow = new Flow('myFlow', plainFlow)
const instance = flow.newInstance(1)

instance.getState().then((state) => {
  console.log(`state: ${state.name}`)
})

instance.getState({ action: 'toState2', type: 'user' }).then((state) => {
  console.log(`new state: ${state.name}`)
})
```

---
With ❤ by @josemanu and @yalochat