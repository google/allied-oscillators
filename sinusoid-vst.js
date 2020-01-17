// Copyright 2019 Google LLC
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

function frequencyForKey(key) {
  const exponent = (key - 69) / 12
  return 440 * Math.pow(2, exponent)
}

class SinusoidProcessor extends AudioWorkletProcessor {
  constructor (options) {
    super()
    this.poly = {}
    this.port.onmessage = this.onmessage.bind(this)
    this.polyphony = 8
    this.gain = 0.8 / this.polyphony
  }
  
  process (inputs, outputs, parameters) {
    const output = outputs[0]
    const gain = this.gain
    const poly = this.poly
    Object.keys(poly).forEach(key => {
      const state = poly[key]
      output.forEach(channel => {
        for (let i = 0; i < channel.length; ++i) {
          channel[i] += (gain * Math.cos(state.phase))
          state.phase += state.phase_per_step
        }
      })
    });
    return true
  }
  
  handleKey (key, velocity) {
    if (velocity == 0) {
      delete this.poly[key]
    } else if (Object.keys(this.poly).length >= this.polyphony && !(key in this.poly)) {
      return
    } else {
      const frequency = frequencyForKey(key)
      this.poly[key] = {
        'velocity'       : velocity,
        'phase'          : 0,
        'phase_per_step' : (2 * Math.PI * frequency) / sampleRate
      }
    }
  }

  onmessage (e) {
    const data = e.data
    if ((data[0] & 0xf0) == 0x90 && data.length == 3) {
      this.handleKey(data[1], data[2])
    }
  }
}

registerProcessor('sinusoid-processor', SinusoidProcessor)
