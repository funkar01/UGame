const fs = require('fs');

try {
  let html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('id="room-id"')) {
    html = html.replace('<div id="pc-instructions"', '<div style="margin-bottom: 1.5rem; text-align: center;">\\n            <label for="room-id" style="color: white; font-weight: bold; display: block; margin-bottom: 0.5rem;">Room ID (Optional)</label>\\n            <input type="text" id="room-id" placeholder="Enter Room ID to join..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; font-size: 1rem; text-align: center; box-sizing: border-box;">\\n          </div>\\n\\n          <div id="pc-instructions"');
    fs.writeFileSync('index.html', html);
    console.log('Successfully injected Room ID into index.html');
  } else {
    console.log('Room ID already injected');
  }
} catch (e) {
  console.error('Failed to patch index.html', e);
}
