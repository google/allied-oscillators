// Copyright 2019-2020 Google LLC
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

import { midi } from './midiutils.mjs';

function generateUid_maker() {
  var next_uid = 0;
  return function() {
    return (next_uid++);
  };
}

const generateUid = generateUid_maker();

const input_select = document.getElementById("input");
const output_select = document.getElementById("output");

function addOption(select, name, select_by_default) {
  const option = document.createElement("option");
  option.innerHTML = name;
  option.uid = generateUid();
  select.options.add(option);
  if (select_by_default) {
    select.selectedIndex = select.options.length - 1;
  }
  return option;
}

export function registerInput(name, select_by_default=false) {
  const option = addOption(input_select, name, select_by_default);
  return option.uid;
}

function removeFromSelect(select, uid) {
  for (i = 0; i < select.options.length; ++i) {
    if (select.options[i].uid == uid) {
      select.options.remove(i);
      return;
    }
  }
}

function selectedOption(select) {
  if (select.options.length && select.selectedIndex >= 0) {
    return select.options[select.selectedIndex];
  } else {
    return null;
  }
}

function optionWithUID(select, uid) {
  for (const option of select.options) {
    if (option.uid == uid) {
      return option;
    }
  }
  return null;
}

function unregisterInput(uid) {
  removeFromSelect(input_select, uid);
}

function unregisterOutput(uid) {
  removeFromSelect(output_select, uid);
}

export function registerOutput(name, fn, select_by_default=false) {
  const option = addOption(output_select, name, select_by_default);
  option.fn = fn;
  return option.uid;
}

function updateChannelControls(input, data) {
  if (!("channel_controls" in input)) {
    input.channel_controls = {};
  }
  const channel_controls = input.channel_controls;
  const channel = data[0] & 0xf;
  if (!(channel in channel_controls)) {
    input.channel_controls[channel] = {};
  }
  channel_controls[channel][data[1]] = data[2];
}

function sendChannelControls() {
  const input = selectedOption(input_select);
  const output = selectedOption(output_select);
  if (input && output) {
    if (!("channel_controls" in input)) {
      return;
    }
    const channel_controls = input.channel_controls;
    for (const channel in channel_controls) {
      const controls = channel_controls[channel];
      for (const control in controls) {
        const value = controls[control];
        output.fn(midi.controlMessage(
          parseInt(channel),
          parseInt(control),
          value));
      }
    }
  }
}

export function dispatchMIDI(input_uid, data) {
  const input = optionWithUID(input_select, input_uid);
  if (midi.isControlMessage(data)) {
     updateChannelControls(input, data);
  }
  if (input == selectedOption(input_select)) {
    const output = selectedOption(output_select);
    if (output) {
      output.fn(data);
    }
  }
}

function registerWebMIDIPort(port) {
  if ('uid' in port) {
    return;
  }
  
  if (port.type == "input") {
    port.uid = registerInput(port.name);
    const uid = port.uid;
    port.onmidimessage = function (e) {
      dispatchMIDI(uid, e.data);
    };
  } else if (port.type == "output") {
    port.uid = registerOutput(port.name, function (data) {
      port.send(data);
    });
  }
}

function unregisterWebMIDIPort(port) {
  if (port.type == "input") {
    unregisterInput(port.uid);
    delete port.uid;
  } else if (port.type == "output") {
    unregisterOutput(port.uid);
    delete port.uid;
  }
}

function onWebMIDIStateChange(e) {
  const port = e.port;
  if (port.state == "connected") {
    registerWebMIDIPort(port);
  } else if (port.state == "disconnected") {
    unregisterWebMIDIPort(port);
  }
}

export async function maybeInitializeWebMIDI() {
  var options = {};
  options.sysex = true;
  const access = await navigator.requestMIDIAccess(options);
  if (!(access instanceof MIDIAccess)) {
    return;
  }
  for (let port of access.inputs.values()) {
    registerWebMIDIPort(port);
  }
  for (let port of access.outputs.values()) {
    registerWebMIDIPort(port);
  }
  access.onstatechange = onWebMIDIStateChange;
  input_select.onchange = sendChannelControls;
  output_select.onchange = sendChannelControls;
}
