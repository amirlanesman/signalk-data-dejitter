/*
 * Copyright 2017 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Bacon = require('baconjs')
const _ = require('lodash')

module.exports = function (app) {
  let plugin = {}
  let unsubscribes = []

  plugin.start = function (props) {
    plugin.properties = props

    plugin.properties.values.forEach(valueConfig => {

      let stream = app.streambundle.getSelfStream(valueConfig.inputPath)
      let count = 0
      let cache = 0;
      unsubscribes.push(
        Bacon.combineWith(val => {
          count++
          // cache = cache + (val - cache) / count
          cache = calc(valueConfig.calc, val, cache, count)
          if (count === valueConfig.period) {
            const res = cache
            cache = 0
            count = 0
            return res
          }
        }, stream)
          // .changes()
          // .debounceImmediate(calculation.debounceDelay || 20)
          // .skipDuplicates(skip_function)
          .onValue(value => {
            if (value) {
              let delta = {
                // context: 'vessels.' + app.selfId,
                context: 'vessels.' + app.selfId,
                updates: [
                  {
                    values: [{ path: valueConfig.outputPath, value: value }]
                  }
                ]
              }
              // app.debug("got delta: " + JSON.stringify(delta))
              app.handleMessage(plugin.id, delta)
            }
          })
      )
    })
  }

  plugin.stop = function () {
    unsubscribes.forEach(f => f())
    unsubscribes = []
  }

  plugin.id = 'dejittered'
  plugin.name = 'Dejitter'
  plugin.description = 'Plugin that dejitters data'

  plugin.schema = {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        title: 'Values to average',
        default: [],
        items: {
          type: 'object',
          required: ['inputPath', 'outputPath', 'calc', 'period'],
          properties: {
            inputPath: {
              type: 'string',
              title: 'The path of the SignalK data to use.',
              default: 'navigation.speedOverGround',
            },
            outputPath: {
              type: 'string',
              title: 'The path of the SignalK data to create.',
              default: 'navigation.averageSpeedOverGround',
            },
            period: {
              type: 'integer',
              title: 'Calculation period in data frames (>0)',
              default: 5,
              minimum: 1
            },
            calc: {
              type: 'string',
              title: 'Calculation to apply',
              default: 'average',
              enum: ['average', 'min', 'max', 'radialAverage']
            }
          }
        }
      },
    }
  }



  return plugin
}

function calc(type, val, cache, count) {
  switch (type) {
    case 'average':
      return cache + (val - cache) / count
    case 'radialAverage':
      const sincache = Math.sin(toRad(cache))
      const coscache = Math.cos(toRad(cache))
      const y = sincache + (Math.sin(toRad(val)) - sincache) / count
      const x = coscache + (Math.cos(toRad(val)) - coscache) / count
      return toDeg(Math.atan2(y,x))
    case 'max':
      return _.max([val, cache])
    case 'min':
      return _.min([val, cache])
  }
}

toDeg = (angle) => (angle * (180 / Math.PI))
toRad = (angle) => (angle * (Math.PI / 180))



