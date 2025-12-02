const robot = require('robotjs');
console.log('RobotJS loaded successfully');
try {
    const mouse = robot.getMousePos();
    console.log('Mouse pos:', mouse);
} catch (e) {
    console.error(e);
}
