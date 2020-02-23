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

// jshint esversion: 6

import { midi } from './midiutils.mjs';
import { adsr } from './adsr.mjs';

const params_for_controls = Object.freeze({
  [73] : adsr.attack,
  [75] : adsr.decay,
  [79] : adsr.sustain,
  [72] : adsr.release
});

const durationUnit = sampleRate / 127;
const nonlinearFactor = 1.02;
  // 0 =>   0       (instant)
  // 1 =>   1.02    (1/127 second)
  // 16 =>  21.96   (1/6 second)
  // 64 =>  227.30  (1.79 second)
  // 127 => 1570.46 (12.37 second)

function linearDuration(nonlinear_duration) {
  return durationUnit * nonlinear_duration * Math.pow(nonlinearFactor, nonlinear_duration);
}

class SinusoidVST extends AudioWorkletProcessor {
  constructor (options) {
    super();
    this.voices = {};
    this.port.onmessage = this.onmessage.bind(this);
    this.polyphony = 8;
    this.gain = 0.8 / this.polyphony;
    this.params = {
      [adsr.attack] : linearDuration(16),  // 0 is instant full gain, 127 is silence
      [adsr.decay]  : linearDuration(16),   // 0 is instant decay to sustain level, 127 is full gain while held
      [adsr.sustain] : 0.5,                // * total gain
      [adsr.release] : linearDuration(16), // 0 is instant silence, 127 is note held forever
    };
  }

  process (inputs, outputs, parameters) {
    const output = outputs[0];
    const gain = this.gain;
    const voices = this.voices;
    for (let key in voices) {
      const voice = voices[key];
      if (voice.gain.done()) {
        continue;
      }
      for (let channel of output) {
        for (let i = 0; i < channel.length; ++i) {
          const voice_gain = voice.gain.updateGain();
          channel[i] += (gain * voice_gain * Math.cos(voice.phase));
          voice.phase += voice.phase_per_step;
        }
      }
    }
    return true;
  }

  gcKeys () {
    var freeList = [];
    var voices = this.voices;
    Object.keys(voices).forEach(key => {
      if (voices[key].gain.done()) {
        freeList.push(key);
      }
    });
    freeList.forEach(key => {
      delete voices[key];
    });
  }

  handleKey (key, velocity) {
    if (velocity == 0) {
      if (key in this.voices) {
        const voice = this.voices[key];
        voice.gain.release();
      }
      return;
    }
    this.gcKeys();
    if (Object.keys(this.voices).length >= this.polyphony && !(key in this.voices)) {
      return;
    } else {
      const frequency = midi.frequencyForKey(key);
      this.voices[key] = {
        'velocity'       : velocity,
        'gain'           : new adsr.Gain(this.params),
        'phase'          : 0,
        'phase_per_step' : (2 * Math.PI * frequency) / sampleRate
      };
    }
  }

  handleControl (control, value) {
    if (value < 0)
      value = 0;
    if (value > 127)
      value = 127;

    if (!(control in params_for_controls))
      return;

    const param = params_for_controls[control];

    switch (param) {
      case adsr.attack:
      case adsr.decay:
      case adsr.release:
        this.params[param] = linearDuration(value);
        break;
      case adsr.sustain:
        this.params[param] = value / 127.0;
        break;
      default:
        break;
    }
  }

  onmessage (e) {
    const data = e.data;
    if (midi.isKeyMessage(data)) {
      this.handleKey(data[1], data[2]);
    } else if (midi.isControlMessage(data)) {
      this.handleControl(data[1], data[2]);
    }
  }
}

registerProcessor('sinusoid-vst', SinusoidVST);
