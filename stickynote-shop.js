function SNShop() {
  var img = null;

  var feedbackMatchingNote = false;
  var feedbackX = 0; // in input image space
  var feedbackY = 0;

  var stickyNoteWidth = 0;
  var stickyNoteHeight = 0;

  var palettes = [
    {
      colors: [0xFFFFFF, 0xE9FE1B, 0x7AF133, 0x62BCBD, 0xE52763, 0x8A64DE, 0xF68A03, 0x31A0E7],
      name: 'Sticky Notes',
      default: true,
    },
    {
      colors: [0xFFFFFF, 0xDE000D, 0x0057A8, 0x007B28, 0x95B90B, 0xFEC400, 0xE76318, 0x300F06, 0x010101],
      name: 'Lego',
    }
  ];
  var paletteIdx = 0;
  var curPalette = palettes[paletteIdx];

  var buildPalettes = function() {
    var elem = document.getElementById('palettes');
    var html = '';
    for (var paletteIdx in palettes) {
      var palette = palettes[paletteIdx];
      html += '<div style="height:20px;">';
      html += '<input ' + (palette.default ? 'checked' : '') + ' style="float:left" type="radio" name="palette" value="' + paletteIdx + '" />'
      if (palette.default) {
        curPalette = palette;
      }
      for (var colorIdx in palette.colors) {
        var color = palette.colors[colorIdx];
        var hexLiteral = color.toString(16);
        hexLiteral = '0000000'.substr(0, 6 - hexLiteral.length) + hexLiteral;
        html += '<span style="width:20px; height:20px;background-color:#' + hexLiteral + '; float:left;"></span>';
      }
      html += '( ' + palettes[paletteIdx].name + ' )';
      html += '</div>'
    }
    elem.innerHTML = html;
    var inputs = elem.querySelectorAll('[name="palette"]');
    for (var i = 0; i<inputs.length; i++) {
      inputs[i].addEventListener('change', refresh);
    }
  }

  function getStickyWidthElem() {
    return document.getElementById('sticky-width');
  }
  function getStickyHeightElem() {
    return document.getElementById('sticky-height');
  }

  this.init = function() {
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

    function handleInputUrlSelected(ev) {
      var urlElem = document.querySelector('#input-widget input[name=url]')
      var url = urlElem.value;
      if (url) {
        setInputImage(url);
      } else {
        // no input. Give focus to the input element
        urlElem.focus();
      }
    }
    document.querySelector('#input-widget input[name=url-button]').addEventListener('click', handleInputUrlSelected, false);

    document.getElementById('image-shrink-algo').addEventListener('change', refresh, false);
    document.getElementById('color-compare-algo').addEventListener('change', refresh, false);

    setInputImage('images/ship-viking-0.png');
    // setInputImage('image.jpg');
  }

  var cannotLoadInputImage = function() {
    window.alert('Cannot load image.');
  }

  var showLoading = function() {
    var ctx = document.getElementById("pcanvas").getContext("2d");
    ctx.font = '20px sans-serif';
    ctx.strokeText("Loading ...", 100, 100)
  }

  var corsProxy = 'https://crossorigin.me/';
  var setInputImage = function(src) {
    showLoading();
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

  var prepareForSn = function(imageData) {
    var height = imageData.height;
    var width = imageData.width;
    var idata = imageData.data;

    // apply alpha channel
    for (var y = 0; y<height; y++) {
      for (var x = 0; x<width; x++) {
        var offset = (y*height + x)*4;
        var alpha = idata[offset + 3];
        // Optimization: if no thransperancy then don't do anything.
        if (alpha !== 255) {
          var mult = 1 - (alpha / 255.0);
          idata[offset + 0] = idata[offset + 0] + (255 - idata[offset + 0])*mult;
          idata[offset + 1] = idata[offset + 1] + (255 - idata[offset + 1])*mult;
          idata[offset + 2] = idata[offset + 2] + (255 - idata[offset + 2])*mult;
          idata[offset + 3] = 255; // for completeness
        }
      }
    }

    if (typeof getImageColorForRegion.prepare === 'function') {
      getImageColorForRegion.prepare();
    }
  }

  var runSn = function(imageData, octx) {
    var height = imageData.height;
    var width = imageData.width;
    var idata = imageData.data;

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

    // test for ycbr <-> rgb conversion
    /* for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var offset = (y*width + x) * 4;
        var rgb = (idata[offset] << 16) + (idata[offset + 1] << 8) + idata[offset + 2];

        var ycbcr = rgb_to_ycbcr(rgb);
        rgb = ycbcr_to_rgb(ycbcr);

        idata[offset] = rgb_r(rgb);
        idata[offset + 1] = rgb_g(rgb);
        idata[offset + 2] = rgb_b(rgb);

      }
    }
    octx.putImageData(imageData, 0, 0); */
  }

  var refreshPreview = function() {
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

  var refresh = this.refresh = function () {
    // console.log('refreshing');
    stickyNoteWidth = parseInt(document.getElementById('sticky-width').value);
                      stickyNoteHeight = parseInt(document.getElementById('sticky-height').value);

    var imageShrinkAlgoName = document.getElementById('image-shrink-algo').value;
    getImageColorForRegion = {'topLeft': getImageColorForRegion_topLeft,
                              'center': getImageColorForRegion_center,
                              'avarage': getImageColorForRegion_avg,
                              'fivePoint': getImageColorForRegion_fivePoint,
                              'centerSquareAvg': getImageColorForRegion_centerSquareAvg,
                              'lanczos': getImageColorForRegion_lanczos,
                            }[imageShrinkAlgoName];

    var colorCompareAlgoName = document.getElementById('color-compare-algo').value;
    colorDiff = {'luma': colorDiff_luma,
                 'ycrcb': colorDiff_YCbCr,
                 'rgb-linear': colorDiff_linear,
                 'Lab': colorDiff_lab,
                 'LabLightness': colorDiff_lablightness,
                }[colorCompareAlgoName];

    curPalette = palettes[parseInt(document.querySelector('[name="palette"]:checked').value)];

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

    var imageData = ictx.getImageData(0, 0, width, height);

    prepareForSn(imageData);
    runSn(imageData, octx);
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
  function getImageColorForRegion_lanczos(idata, xPixel, yPixel, regWidth, regHeight) {
    var self = getImageColorForRegion_lanczos;
    var scaledWidth = self.scaledImageData.width;

    var syPixel = yPixel / stickyNoteWidth;
    var sxPixel = xPixel / stickyNoteWidth;

    var r = self.scaledData[((syPixel * scaledWidth) + sxPixel)*4 + 0];
    var g = self.scaledData[((syPixel * scaledWidth) + sxPixel)*4 + 1];
    var b = self.scaledData[((syPixel * scaledWidth) + sxPixel)*4 + 2];
    return (r << 16) + (g << 8) + (b);
  }
  getImageColorForRegion_lanczos.prepare = function(imageData) {
    var widthInSN = ~~(img.width/stickyNoteWidth);

    var canvas = document.createElement('canvas');
    var t = new thumbnailer(canvas, img, widthInSN, 3);

    getImageColorForRegion_lanczos.scaledImageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    getImageColorForRegion_lanczos.scaledData = getImageColorForRegion_lanczos.scaledImageData.data;

    // TODO use the input imageData to prepare the lanczos instead of img. In doing so there will be no need to do this extra alpha channel elimination
    // apply alpha channel
    var height = getImageColorForRegion_lanczos.scaledImageData.height;
    var width = getImageColorForRegion_lanczos.scaledImageData.width;
    var idata = getImageColorForRegion_lanczos.scaledData;
    for (var y = 0; y<height; y++) {
      for (var x = 0; x<width; x++) {
        var offset = (y*height + x)*4;
        var alpha = idata[offset + 3];
        // Optimization: if no thransperancy then don't do anything.
        if (alpha !== 255) {
          var mult = 1 - (alpha / 255.0);
          idata[offset + 0] = idata[offset + 0] + (255 - idata[offset + 0])*mult;
          idata[offset + 1] = idata[offset + 1] + (255 - idata[offset + 1])*mult;
          idata[offset + 2] = idata[offset + 2] + (255 - idata[offset + 2])*mult;
          idata[offset + 3] = 255; // for completeness
        }
      }
    }
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
    var min = Infinity;
    var res = 0xFF0000;
    for (var i = 0; i<curPalette.colors.length; i++) {
      var snColor = curPalette.colors[i];
      var diff = colorDiff(snColor, color);
      if (diff < min) {
        min = diff;
        res = snColor;
      }
    }
    return res;
  }

  function rgb_to_ycbcr(c) {
    var r = rgb_r(c);
    var g = rgb_g(c);
    var b = rgb_b(c);

    function byte(n) {
      return n & 0xFF;
    }

    var y = byte( 0 + (0.299 * r) + (0.587 * g) + (0.114 * b) );
    var cb = byte( 128 - (0.168736 * r) - (0.331264 * g) + (0.5 * b) );
    var cr = byte( 128 + (0.5 * r) - (0.418688 * g) - (0.081312 * b) );
    return (y << 16) | (cb << 8) | cr;
  }
  function ycbcr_to_rgb(c) {
      var y = rgb_r(c);
      var cb = rgb_g(c);
      var cr = rgb_b(c);

      function clamp(n) {
        if (n < 0) return 0;
        if (n > 255) return 255;
        return n & 0xFF;
      }

      var r = clamp( y + 1.402 * (cr - 128) );
      var g = clamp( y - 0.34414 * (cb - 128) - 0.71414 * (cr - 128) );
      var b = clamp( y + 1.772 * (cb - 128) );

      return (r << 16) | (g << 8) | b;
  }

  var ycbcr_y = rgb_r;
  var ycbcr_cb = rgb_g;
  var ycbcr_cr = rgb_b;

  function rgb_to_xyz(rgb) {
    // source http://www.easyrgb.com/index.php?X=MATH&H=02#text2
    var var_R = ( rgb_r(rgb) / 255 );        //R from 0 to 255
    var var_G = ( rgb_g(rgb) / 255 );        //G from 0 to 255
    var var_B = ( rgb_b(rgb) / 255 );        //B from 0 to 255

    if ( var_R > 0.04045 ) var_R = Math.pow( ( var_R + 0.055 ) / 1.055 , 2.4);
    else                   var_R = var_R / 12.92;
    if ( var_G > 0.04045 ) var_G = Math.pow( ( var_G + 0.055 ) / 1.055 , 2.4);
    else                   var_G = var_G / 12.92;
    if ( var_B > 0.04045 ) var_B = Math.pow( ( var_B + 0.055 ) / 1.055 , 2.4);
    else                   var_B = var_B / 12.92;

    var_R = var_R * 100;
    var_G = var_G * 100;
    var_B = var_B * 100;

    //Observer. = 2°, Illuminant = D65
    X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
    Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
    Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;

    return [X, Y, Z];
  }

  function xyz_to_lab(xyz) {
    var ref_X = 95.047, ref_Y = 100.000, ref_Z = 108.883;
    var X = xyz[0], Y = xyz[1], Z = xyz[2];
    var_X = X / ref_X ;         //ref_X =  95.047   Observer= 2°, Illuminant= D65
    var_Y = Y / ref_Y ;         //ref_Y = 100.000
    var_Z = Z / ref_Z ;         //ref_Z = 108.883

    if ( var_X > 0.008856 ) var_X = Math.pow(var_X, ( 1/3 ));
    else                    var_X = ( 7.787 * var_X ) + ( 16 / 116 );
    if ( var_Y > 0.008856 ) var_Y = Math.pow(var_Y , ( 1/3 ));
    else                    var_Y = ( 7.787 * var_Y ) + ( 16 / 116 );
    if ( var_Z > 0.008856 ) var_Z = Math.pow(var_Z , ( 1/3 ));
    else                    var_Z = ( 7.787 * var_Z ) + ( 16 / 116 );

    L = ( 116 * var_Y ) - 16;
    a = 500 * ( var_X - var_Y );
    b = 200 * ( var_Y - var_Z );

    return [L, a, b];
  }

  function rgb_to_lab(rgb) {
    var xyz = rgb_to_xyz(rgb);
    var lab = xyz_to_lab(xyz);
    return lab;
  }

  function abs(x) {
    return Math.abs(x);
  }

  function colorDiff_linear(a, b) {
    return abs(rgb_r(a) - rgb_r(b)) + abs(rgb_g(a) - rgb_g(b)) + abs(rgb_b(a) - rgb_b(b));
  }
  function colorDiff_YCbCr(a_rgb, b_rgb) {
    a = rgb_to_ycbcr(a_rgb);
    b = rgb_to_ycbcr(b_rgb);

    return 2*abs(ycbcr_y(a) - ycbcr_y(b)) + abs(ycbcr_cb(a) - ycbcr_cb(b)) + abs(ycbcr_cr(a) - ycbcr_cr(b));
  }
  function colorDiff_luma(a_rgb, b_rgb) {
    a = rgb_to_ycbcr(a_rgb);
    b = rgb_to_ycbcr(b_rgb);

    return abs(ycbcr_y(a) - ycbcr_y(b));
  }
  function colorDiff_lab(a_rgb, b_rgb) {
    var a = rgb_to_lab(a_rgb);
    var b = rgb_to_lab(b_rgb);
    return Math.sqrt( Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2) );
  }
  function colorDiff_lablightness(a_rgb, b_rgb) {
    var a = rgb_to_lab(a_rgb);
    var b = rgb_to_lab(b_rgb);
    return Math.abs(a[0] - b[0]);
  }
  var colorDiff = colorDiff_luma;

}
