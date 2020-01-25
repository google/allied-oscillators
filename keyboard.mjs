export async function createVirtualKeyboard(keyboard, dispatch) {
  const keys =
        ['a','w','s','d','r','f','t','g','h','u','j','i','k','o','l',';','[',"'",']'];
  const isWhite =
        [ 1,  0,  1,  1,  0,  1,  0,  1,  1,  0,  1,  0,  1,  0,  1,  1,  0,  1,  0 ];

  keyboard.style.height = "100px";
  keyboard.style.width = "400px";
  keyboard.style.position = "relative";

  const numWhiteKeys = arraySum(isWhite);
  const keyWidth = (100 / numWhiteKeys);
  
  function arraySum(a) {
    function sum(a,b) {
      return a+b;
    }
    return a.reduce(sum, 0);
  }

  function keyLeft(i) {
    const numWhiteKeysBefore = arraySum(isWhite.slice(0,i));
    return (numWhiteKeysBefore * keyWidth) -
      (isWhite[i] ? 0 : (keyWidth/2));
  }
  
  const channel = 0;
  
  function makeMIDIData(channel, key, velocity) {
    return [0x90 | channel, key, velocity];
  }
  
  function makeMouseDownHandler(key) {
    return function(e) {
      dispatch(makeMIDIData(channel, key, 64));
    };
  }

  function makeMouseUpHandler(key) {
    return function(e) {
      dispatch(makeMIDIData(channel, key, 0));
    };
  }

  function contextMenuHandler(e) {
    if(e.preventDefault != undefined) {
      e.preventDefault();
    }
    if(e.stopPropagation != undefined) {
      e.stopPropagation();
    }
    return false;
  }

  for (var i = 0; i < keys.length; ++i) {
    const key = document.createElement("div");
    keyboard.appendChild(key);

    const span = document.createElement("span");
    key.appendChild(span);

    const text = document.createTextNode(keys[i]);
    span.appendChild(text);

    key.style.position = "absolute";
    key.style.display = "flex";
    key.style.justifyContent = "center";
    key.style.alignItems = "flex-end";
    key.style.left = keyLeft(i).toString() + "%";
    key.style.bottom = isWhite[i] ? "0%" : "50%";
    key.style.height = isWhite[i] ? "100%" : "50%";
    key.style.width = keyWidth.toString() + "%";
    key.style.borderStyle = "solid";
    key.style.borderWidth = "thin";
    key.style.borderColor = isWhite[i] ? "black" : "white";
    key.style.color = isWhite[i] ? "black" : "white";
    key.style.backgroundColor = isWhite[i] ? "white" : "black";
    key.style.zIndex = isWhite[i] ? 0 : 1;

    const downHandler = makeMouseDownHandler(57 + i);
    const upHandler = makeMouseUpHandler(57+ i);

    key.addEventListener('mousedown', downHandler);
    key.addEventListener('mouseup', upHandler);
    key.addEventListener('touchstart', downHandler);
    key.addEventListener('touchend', upHandler);
    key.addEventListener('contextmenu', contextMenuHandler);
  }
    
  function keyDown(e) {
    if (event.isComposing || event.repeat || event.keyCode === 229) {
      return;
    }
    i = keys.findIndex(k => k == event.key);
    if (i == -1) {
      return;
    }
    dispatch(makeMIDIData(channel, 57 + i, 64));
  } 

  function keyUp(e) {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    i = keys.findIndex(k => k == event.key);
    if (i == -1) {
      return;
    }
    dispatch(makeMIDIData(channel, 57 + i, 0));
  } 

  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);
  
  return input;
}
