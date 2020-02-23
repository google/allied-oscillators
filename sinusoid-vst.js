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
import { polyphony } from './polyphony.mjs';

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

class SinusoidVoice extends polyphony.Voice {
  constructor () {
    super();
    this.gain = new adsr.Gain();
    this.reset();
  }

  reset () {
    super.reset();
    this.velocity = 0;
    this.gain.reset();
    this.phase = 0;
    this.phase_per_step = 0;
  }

  keyDown (key, velocity, params) {
    super.keyDown(key);
    this.velocity = velocity;
    this.gain.set(params);
    this.phase = 0;
    const frequency = midi.frequencyForKey(key);
    this.phase_per_step = (2 * Math.PI * frequency) / sampleRate;
  }
}

class SinusoidVST extends AudioWorkletProcessor {
  constructor (options) {
    super();
    this.polyphony = new polyphony.Polyphony(8, SinusoidVoice);
    this.port.onmessage = this.onmessage.bind(this);
    this.gain = 0.8 / this.polyphony.count();
    this.params = {
      [adsr.attack]  : linearDuration(16), // 0 is instant full gain, 127 is silence
      [adsr.decay]   : linearDuration(16), // 0 is instant decay to sustain level, 127 is full gain while held
      [adsr.sustain] : 0.5,                // * total gain
      [adsr.release] : linearDuration(16), // 0 is instant silence, 127 is note held forever
    };
  }

  process (inputs, outputs, parameters) {
    const output = outputs[0];
    const gain = this.gain;
    const polyphony = this.polyphony;
    for (let voice of polyphony.voices) {
      const key = voice.key;
      if (key == null) {
        continue;
      }
      if (voice.gain.done()) {
        voice.reset();
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

  allSoundOff () {
    for (let voice of polyphony.voices) {
      voice.reset();
    }
  }

  handleKey (key, velocity) {
    if (velocity == 0) {
      const voice = this.polyphony.get(key);
      if (voice) {
        voice.gain.release();
      }
    } else {
      let voice = this.polyphony.get(key);
      if (!voice) {
        voice = this.polyphony.get(null);
      }
      if (voice) {
        voice.keyDown(key, velocity, this.params);
      }
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
    if (midi.isAllSoundOff(data)) {
      this.allSoundOff();
    } else if (midi.isKeyMessage(data)) {
      this.handleKey(data[1], data[2]);
    } else if (midi.isControlMessage(data)) {
      this.handleControl(data[1], data[2]);
    }
  }
}

registerProcessor('sinusoid-vst', SinusoidVST);
