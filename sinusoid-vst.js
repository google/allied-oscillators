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

function frequencyForKey(key) {
  const exponent = (key - 69) / 12;
  return 440 * Math.pow(2, exponent);
}

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

function fractionOfDuration(elapsed, duration) {
  if (elapsed >= duration) {
    return 1; // we've already saturated it
  } else {
    return elapsed / duration;
  }
}

// applySlope doesn't call fractionOfDuration because the processor needs
// to know it to advance the state of the envelope
function applySlope(start_level, end_level, fraction) {
  return start_level + ((end_level - start_level) * fraction);
}

const ADSR = Object.freeze({
  'attack'  : 73,
  'decay'   : 75,
  'sustain' : 79,
  'release' : 72
});

function initialADSRState(adsr) {
  if (adsr[ADSR.attack] != 0) {
    return ADSR.attack;
  } else if (adsr[ADSR.decay] != 0) {
    return ADSR.decay;
  } else {
    return ADSR.sustain;
  }
}

function nextADSRState(adsr, state) {
  switch (state) {
    case ADSR.attack:
      if (adsr[ADSR.decay] == 0) {
        return ADSR.sustain;
      }
      return ADSR.decay;
    case ADSR.decay:
      return ADSR.sustain;
    case ADSR.sustain:
      return ADSR.sustain;
    case ADSR.release:
      return ADSR.release;
    default:
      throw "Unhandled state";
  }
}

function levelPair(voice, adsr) {
  switch (voice.state) {
    case ADSR.attack:
      return [0.0, 1.0];
    case ADSR.decay:
      return [1.0, adsr[ADSR.sustain]];
    case ADSR.sustain:
      return [adsr[ADSR.sustain], adsr[ADSR.sustain]];
    case ADSR.release:
      return [voice.start_gain, 0.0];
    default:
      throw "Unhandled state";
  }
}

function stateName(state) {
  switch (state) {
    case ADSR.attack:
      return "A";
    case ADSR.decay:
      return "D";
    case ADSR.sustain:
      return "S";
    case ADSR.release:
      return "R";
    default:
      throw "Unhandled state";
  }
}

function updateADSR(voice, adsr) {
  const duration = (voice.state == ADSR.sustain) ?  0 : adsr[voice.state];
  var fraction = fractionOfDuration(voice.elapsed, duration);

  if (fraction >= 1) {
    const before = voice.state;
    const after = nextADSRState(adsr, before);
    voice.state = after;
    voice.start_gain = voice.gain;
    voice.elapsed = 0;
    fraction = 0;
  }

  const levels = levelPair(voice, adsr);
  voice.gain = applySlope(levels[0], levels[1], fraction);
  voice.elapsed++;
}

class SinusoidProcessor extends AudioWorkletProcessor {
  constructor (options) {
    super();
    this.voices = {};
    this.port.onmessage = this.onmessage.bind(this);
    this.polyphony = 8;
    this.gain = 0.8 / this.polyphony;
    this.adsr = {};
    this.adsr[ADSR.attack]  = linearDuration(16);    // 0 is instant full gain, 127 is silence
    this.adsr[ADSR.decay]   = linearDuration(16);    // 0 is instant decay to sustain level, 127 is full gain while held
    this.adsr[ADSR.release] = linearDuration(16);    // 0 is instant silence, 127 is note held forever
    this.adsr[ADSR.sustain] = 0.5;                   // * total gain
  }
  
  process (inputs, outputs, parameters) {
    const output = outputs[0];
    const gain = this.gain;
    const voices = this.voices;
    var keys_to_delete = [];
    Object.keys(voices).forEach(key => {
      const voice = voices[key];
      output.forEach(channel => {
        for (let i = 0; i < channel.length; ++i) {
          updateADSR(voice, this.adsr);
          const voice_gain = voice.gain;
          if (voice_gain == 0 && voice.state == ADSR.release) {
            keys_to_delete.push(key);
          }
          channel[i] += (gain * voice_gain * Math.cos(voice.phase));
          voice.phase += voice.phase_per_step;
        }
      });
    });
    for (const key of keys_to_delete) {
      delete voices[key];
    }
    return true;
  }
  
  handleKey (key, velocity) {
    if (velocity == 0) {
      if (key in this.voices) {
        if (this.adsr[ADSR.release] == 0) {
          delete this.voices[key];
        } else {
          const before = this.voices[key].state;
          const after = ADSR.release;
          this.voices[key].state = after;
          this.voices[key].start_gain = this.voices[key].gain;
        }
      }
    } else if (Object.keys(this.voices).length >= this.polyphony && !(key in this.voices)) {
      return;
    } else {
      const frequency = frequencyForKey(key);
      this.voices[key] = {
        'velocity'       : velocity,
        'state'          : initialADSRState(this.adsr),
        'elapsed'        : 0,
        'start_gain'     : 0,
        'gain'           : 0,
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

    switch (control) {
      case ADSR.attack:
      case ADSR.decay:
      case ADSR.release:
        this.adsr[control] = linearDuration(value);
        break;
      case ADSR.sustain:
        this.adsr[control] = value / 127.0;
        break;
      default:
        throw "Unhandled state";
    }
  }

  onmessage (e) {
    const data = e.data;
    const cmd = data[0] & 0xf0;
    switch (cmd) {
      case 0x90:
        if (data.length == 3) {
          this.handleKey(data[1], data[2]);
        }
        break;
      case 0xb0:
        if (data.length == 3) {
          this.handleControl(data[1], data[2]);
        }
        break;
      default:
        break;
    }
  }
}

registerProcessor('sinusoid-processor', SinusoidProcessor);
