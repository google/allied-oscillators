// Copyright 2020 Google LLC
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

const ADSR = Object.freeze({
  'attack'  : 'attack',
  'decay'   : 'decay',
  'sustain' : 'sustain',
  'release' : 'release'
});

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
  if (fraction >= 1) {
    return end_level;
  }
  return start_level + ((end_level - start_level) * fraction);
}

class Gain {
  constructor() {
    this.reset();
  }

  setState(state) {
    this.state = state;
    this.start_gain = this.gain;
    this.elapsed = 0;
  }

  setInitialState() {
    if (this.params[ADSR.attack] != 0) {
      this.setState(ADSR.attack);
    } else if (this.params[ADSR.decay] != 0) {
      this.setState(ADSR.decay);
    } else {
      this.setState(ADSR.sustain);
    }
  }

  nextState() {
    switch (this.state) {
      case ADSR.attack:
        if (this.params[ADSR.decay] == 0) {
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

  levelPair() {
    switch (this.state) {
      case ADSR.attack:
        return [0, 1];
      case ADSR.decay:
        return [1, this.params[ADSR.sustain]];
      case ADSR.sustain:
        return [this.params[ADSR.sustain], this.params[ADSR.sustain]];
      case ADSR.release:
        return [this.start_gain, 0];
      default:
        throw "Unhandled state";
    }
  }

  updateGain() {
    const duration =
      (this.state == ADSR.sustain) ? 0 : this.params[this.state];

    var fraction = fractionOfDuration(this.elapsed, duration);

    if (fraction >= 1) {
      const new_state = this.nextState();
      if (new_state != this.state) {
        this.setState(new_state);
        fraction = 0;
      }
    }

    const levels = this.levelPair();
    this.gain = applySlope(levels[0], levels[1], fraction);

    this.elapsed++;
    return this.gain;
  }

  release() {
    this.setState(ADSR.release);
    if (this.params[ADSR.release] == 0) {
      this.gain = 0;
    }
  }

  done() {
    return (this.gain == 0 && this.state == ADSR.release);
  }

  reset() {
    this.params = null;
    this.state = null;
    this.gain = 0;
    this.start_gain = 0;
  }

  set(params) {
    this.reset();
    this.params = params;
    this.setInitialState();
  }
}

export const adsr = {
  'attack' : ADSR.attack,
  'decay' : ADSR.decay,
  'sustain' : ADSR.sustain,
  'release' : ADSR.release,
  'Gain' : Gain
};
