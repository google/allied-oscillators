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

// jshint esversion: 8

export const midi = {
  'keyMessage' : function(channel, key, velocity) {
    return [0x90 | channel, key, velocity];
  },
  'controlMessage' : function(channel, id, value) {
    return [0xb0 | channel, id, value];
  },
  'allSoundOff' : function(channel) {
    return [0xb0 | channel, 0x78, 0x0];
  },
  'isKeyMessage' : function(message) {
    return (message.length == 3) && ((message[0] & 0xf0) == 0x90);
  },
  'isControlMessage' : function(message) {
    return (message.length == 3) && ((message[0] & 0xf0) == 0xb0);
  },
  'isAllSoundOff' : function(message) {
    return (message.length == 3) &&
      ((message[0] & 0xf0) == 0xb0) &&
      (message[1] == 0x78) &&
      (message[2] == 0x0);
  },
  'frequencyForKey' : function(key) {
    const exponent = (key - 69) / 12;
    return 440 * Math.pow(2, exponent);
  }
};

