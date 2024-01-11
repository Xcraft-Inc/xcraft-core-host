class Screen {
  static getDefaultWindowBounds(uWidth = null, uHeight = null) {
    const {screen} = require('electron');
    const point = screen.getCursorScreenPoint();
    const {x, y, width, height} = screen.getDisplayNearestPoint(point).workArea;
    // Use 80% of work area
    const factor = 0.8;
    let bounds = {
      x,
      y,
      width: uWidth || width * factor,
      height: uHeight || height * factor,
    };
    // If the window is smaller than 1280x720, use 100% of work area
    if (!uWidth && !uHeight && (bounds.width < 1280 || bounds.height < 720)) {
      bounds.width = width;
      bounds.height = height;
    }
    bounds.width = parseInt(bounds.width);
    bounds.height = parseInt(bounds.height);
    // Center window on current display
    bounds.x = parseInt(x + width / 2 - bounds.width / 2);
    bounds.y = parseInt(y + height / 2 - bounds.height / 2);
    return bounds;
  }
}

module.exports = Screen;
