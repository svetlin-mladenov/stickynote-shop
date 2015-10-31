var img;

var feedbackMatchingNote = false;
var feedbackX = 0; // in input image space
var feedbackY = 0;

var stickyNoteWidth;
var stickyNoteHeight;

var palettes = [
  [0xFFFFFF, 0xE9FE1B, 0x7AF133, 0x62BCBD, 0xE52763, 0x8A64DE, 0xF68A03, 0x31A0E7]
];
var paletteIdx = 0;
var palette = palettes[paletteIdx];

function buildPalettes() {
  var elem = document.getElementById('palettes');
  var html = '';
  for (var paletteIdx in palettes) {
    for (var colorIdx in palettes[paletteIdx]) {
      html += '<span style="width:20px; height:20px;background-color:#' + palettes[paletteIdx][colorIdx].toString(16) + '; float:left;"></span>';
    }
  }
  elem.innerHTML = html;
}

function getStickyWidthElem() {
  return document.getElementById('sticky-width');
}
function getStickyHeightElem() {
  return document.getElementById('sticky-height');
}

function main() {
  var opt_defaultStickyWidth = 30;
  var opt_defaultStickyHeight = 30;
  getStickyWidthElem().value = opt_defaultStickyWidth;
  getStickyHeightElem().value = opt_defaultStickyHeight;

  function refreshStickyDim(ev) {
    var locked = document.getElementById('sticky-dim-lock').checked;
    if (locked) {
      if (ev.target === getStickyWidthElem()) {
        getStickyHeightElem().value = ev.target.value;
      } else {
        getStickyWidthElem().value = ev.target.value;
      }
    }
    refresh();
  }
  getStickyWidthElem().addEventListener('change', refreshStickyDim);
  getStickyHeightElem().addEventListener('change', refreshStickyDim);

  function mouseOverRes(ev) {
    feedbackMatchingNote = true;
    feedbackX = ev.offsetX * img.width / ev.target.width;
    feedbackY = ev.offsetY * img.height / ev.target.height;

    refreshPreview();
  }
  document.getElementById("ocanvas").addEventListener('mousemove', mouseOverRes);

  buildPalettes();

  function handleInputFileSelected(ev) {
    var f = ev.target.files[0];
    var blobUrl = URL.createObjectURL(f);
    setInputImage(blobUrl);
  }
  document.getElementById('input-file').addEventListener('change', handleInputFileSelected, false);

  document.getElementById('image-shrink-algo').addEventListener('change', refresh, false);

  setInputImage('images/ship-viking-0.png');
  // setInputImage('image.jpg');
}

function cannotLoadInputImage() {
  window.alert('Cannot load image.');
}

var corsProxy = 'https://crossorigin.me/';
function setInputImage(src) {
  img = document.createElement("img");
  img.crossOrigin = "Anonymous";
  img.src = src;

  if (img.complete) refresh();
  else {
    img.addEventListener('error', function(ev) {
      if (!src.startsWith('http') || src.startsWith(corsProxy)) {
        cannotLoadInputImage();
      } else {
        console.log('Cannot load the image using a direct request. Trying to load it using a CORS proxy.');
        setInputImage(corsProxy + src);
      }
    });
    img.addEventListener('load', refresh);
  }
}

function refreshPreview() {
  var c = document.getElementById("pcanvas");
                    var ctx=c.getContext("2d");

                    var width = img.width, height = img.height;
  c.height = c.width * height / width;
                    ctx.scale(c.offsetWidth/width, c.offsetHeight/height);
  ctx.drawImage(img, 0, 0);

  if (feedbackMatchingNote) {
    ctx.strokeRect( (~~(feedbackX/stickyNoteWidth))*stickyNoteWidth, (~~(feedbackY/stickyNoteHeight))*stickyNoteHeight, stickyNoteWidth, stickyNoteHeight);
  }
}

function refresh() {
  stickyNoteWidth = parseInt(document.getElementById('sticky-width').value);
                    stickyNoteHeight = parseInt(document.getElementById('sticky-height').value);

  var imageShrinkAlgoName = document.getElementById('image-shrink-algo').value;
  getImageColorForRegion = {'topLeft': getImageColorForRegion_topLeft, 'center': getImageColorForRegion_center, 'avarage': getImageColorForRegion_avg ,'fivePoint': getImageColorForRegion_fivePoint, 'centerSquareAvg': getImageColorForRegion_centerSquareAvg}[imageShrinkAlgoName];


  refreshPreview();
  document.getElementById('dim-in-stickynotes').innerHTML = '(' + ~~(img.width/stickyNoteWidth) + 'x' + ~~(img.height/stickyNoteHeight) + ')';

  var c = document.getElementById("icanvas");

  var ictx=c.getContext("2d");

  var width = img.width, height = img.height;
  c.width = width;
                    c.height = height;


  ictx.drawImage(img, 0, 0);

  var ocanvas = document.getElementById('ocanvas');
  ocanvas.height = ocanvas.width * height / width;
  var octx = ocanvas.getContext('2d');
  octx.scale(ocanvas.offsetWidth/width, ocanvas.offsetHeight/height);

  var idata = ictx.getImageData(0, 0, width, height).data;

  var widthInSN = ~~(width/stickyNoteWidth);
  var heightInSN = ~~(height/stickyNoteHeight);
  for (var x = 0; x<widthInSN; x++) {
    for (var y = 0; y<heightInSN; y++) {
      var xPixel = x*stickyNoteWidth;
      var yPixel = y*stickyNoteHeight;

      var imageColor = getImageColorForRegion(idata, xPixel, yPixel, stickyNoteWidth, stickyNoteHeight);
      var stickyNoteColor = mapToStickyNoteColor(imageColor);
      // var stickyNoteColor = imageColor;

      var fillColor = '000000' + stickyNoteColor.toString(16);
      fillColor = fillColor.substr(fillColor.length - 6, 6);
      octx.fillStyle = '#' + fillColor;
      octx.fillRect(xPixel, yPixel, stickyNoteWidth, stickyNoteHeight);
    }
  }
}

function getImageColorForRegion_topLeft(idata, xPixel, yPixel, regWidth, regHeight) {
    var colorIdx = (yPixel * img.width + xPixel) * 4;
    return (idata[colorIdx] << 16) + (idata[colorIdx+1] << 8) + (idata[colorIdx+2]);
}
function getImageColorForRegion_center(idata, xPixel, yPixel, regWidth, regHeight) {
    xPixel += regWidth >> 1;
                            yPixel += regHeight >> 1;
                            var colorIdx = (yPixel * img.width + xPixel) * 4;
                            return (idata[colorIdx] << 16) + (idata[colorIdx+1] << 8) + (idata[colorIdx+2]);
            }
function getImageColorForRegion_avg(idata, xPixel, yPixel, regWidth, regHeight) {
    var r = .0, g = .0, b = .0;
    var colorIdx = (yPixel * img.width + xPixel) * 4;
    for (var h = 0; h<regHeight; h++) {
      for (var w = 0; w<regWidth; w++) {
        r += idata[colorIdx];
        g += idata[colorIdx+1];
        b += idata[colorIdx+2];
        colorIdx += 4;
      }
      colorIdx += (img.width - regWidth) * 4;
    }
    var q = 1/(regWidth*regHeight);
    r = ~~(r*q);
    g = ~~(g*q);
    b = ~~(b*q);
                            return (r << 16) + (g << 8) + (b);
            }
function getImageColorForRegion_fivePoint(idata, xPixel, yPixel, regWidth, regHeight) {
  var wForth = regWidth >> 2;
  var hForth = regHeight >> 2;

  var colors = [
    pixelColor(idata, xPixel + (regWidth >> 2), yPixel + (regHeight >> 2)),
    pixelColor(idata, xPixel + 3*(regWidth >> 2), yPixel + (regHeight >> 2)),
    pixelColor(idata, xPixel + (regWidth >> 1), yPixel + (regHeight >> 1)),
    pixelColor(idata, xPixel + (regWidth >> 2), yPixel + 3*(regHeight >> 2)),
    pixelColor(idata, xPixel + 3*(regWidth >> 2), yPixel + 3*(regHeight >> 2)),
  ];

  var r = .0, g =.0, b = .0;
  for (var i = 0, color; color = colors[i]; i++) {
    r += rgb_r(color);
    g += rgb_g(color);
    b += rgb_b(color);
  }

  var q = 1/colors.length;
                    r = ~~(r*q);
                    g = ~~(g*q);
                    b = ~~(b*q);
                    return (r << 16) + (g << 8) + (b);
}
function getImageColorForRegion_centerSquareAvg(idata, xPixel, yPixel, regWidth, regHeight) {
  return getImageColorForRegion_avg(idata, xPixel + (regWidth >> 2), yPixel + (regHeight >> 2), regWidth >> 1, regHeight >> 1);
}
var getImageColorForRegion = getImageColorForRegion_avg;

function pixelColor(idata, x, y) {
  var colorIdx = (y * img.width + x) * 4;
  return (idata[colorIdx] << 16) + (idata[colorIdx+1] << 8) + (idata[colorIdx+2]);
}

function rgb_r(color) {
  return (color & 0xFF0000) >>> 16;
}
function rgb_g(color) {
  return (color & 0xFF00) >>> 8;
}
function rgb_b(color) {
  return (color & 0xFF);
}

function mapToStickyNoteColor(color) {
  function abs(x) {
                      return Math.abs(x);
              }

  var min = Infinity;
  var res = color;
  for (var i = 0; i<palette.length; i++) {
    var snColor = palette[i];
    var diff = abs(rgb_r(snColor) - rgb_r(color)) + abs(rgb_g(snColor) - rgb_g(color)) + abs(rgb_b(snColor) - rgb_b(color));
    if (diff < min) {
      min = diff;
      res = snColor;
    }
  }
  return res;
}
