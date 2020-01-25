function generateUid_maker() {
  var next_uid = 0;
  return function() {
    return (next_uid++);
  }
}

const generateUid = generateUid_maker();

const input_select = document.getElementById("input");
const output_select = document.getElementById("output");

export function registerInput(name) {
  const input = document.createElement("option");
  input.innerHTML = name;
  input.uid = generateUid();
  input_select.options.add(input);
  return input.uid;
}

function removeFromSelect(select, uid) {
  for (i = 0; i < select.options.length; ++i) {
    if (select.options[i].uid == uid) {
      select.options.remove(i);
      return;
    }
  }
}

function unregisterInput(uid) {
  removeFromSelect(input_select, uid);
}

function unregisterOutput(uid) {
  removeFromSelect(output_select, uid);
}

export function registerOutput(name, fn) {
  const output = document.createElement("option");
  output.innerHTML = name;
  output.uid = generateUid();
  output.fn = fn;
  output_select.options.add(output);
  return output.uid;
}

export function dispatchMIDI(input_uid, data) {
  if (input_select.options.length && input_select.selectedIndex >= 0 &&
      output_select.options.length && output_select.selectedIndex >= 0 &&
      input_select.options[input_select.selectedIndex].uid == input_uid) {
    output_select.options[output_select.selectedIndex].fn(data);
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
}
