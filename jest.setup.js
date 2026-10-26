jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = (props) => React.createElement(View, props, props.children);
  const MockMarker = (props) => React.createElement(View, props, props.children);
  const MockPolyline = (props) => React.createElement(View, props);
  const MockPolygon = (props) => React.createElement(View, props);
  const MockCircle = (props) => React.createElement(View, props);
  const MockUrlTile = (props) => React.createElement(View, props);

  return {
    __esModule: true,
    default: MockMapView,
    MapView: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
    Polygon: MockPolygon,
    Circle: MockCircle,
    UrlTile: MockUrlTile,
  };
});
