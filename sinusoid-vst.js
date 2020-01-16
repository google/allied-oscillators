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
  constructor(options) {
    super()
    this.updateFrequency(-1)
    this.port.onmessage = this.onmessage.bind(this)
  }
  
  process (inputs, outputs, parameters) {
    const output = outputs[0]
    output.forEach(channel => {
      for (let i = 0; i < channel.length; ++i) {
        if (this.frequency === -1) {
          channel[i] = 0
        } else {
          channel[i] = Math.cos(this.phase)
          this.phase += this.phase_per_step
        }
      }
    })
    return true
  }
  
  updateFrequency (key) {
    if (key === -1) {
      this.phase = 0
      this.frequency = -1
      this.phase_per_step = 0
    } else {
      this.frequency = frequencyForKey(key)
      this.phase_per_step = (2 * Math.PI * this.frequency) / sampleRate
  }
  
  onmessage (e) {
    this.updateFrequency(e.data)
  }
}

registerProcessor('sinusoid-processor', SinusoidProcessor)
