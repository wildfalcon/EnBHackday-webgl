(function($){
  
  $.fn.earth = function(){
    
    var self = this;

    var gl;
    function initGL() {
      var canvas = self[0];
      
      try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewport(0, 0, canvas.width, canvas.height);
      } catch(e) {
      }
      if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
      }
    }


    function getShader(gl, str, type) {

      var shader;
      if (type == "fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
      } else if (type == "vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
      } else {
        return null;
      }

      gl.shaderSource(shader, str);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
      }

      return shader;
    }


    var shaderProgram;
    function initShaders() {
      var fragment_src = "                       \n\
        varying vec2 vTextureCoord;              \n\
        varying vec3 vLightWeighting;            \n\
        \n\
        uniform sampler2D uSampler;              \n\
        \n\
        void main(void) {                        \n\
          vec4 textureColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));\n\
          gl_FragColor = vec4(textureColor.rgb * vLightWeighting, textureColor.a);\n\
        }\n\
      ";
      var fragmentShader = getShader(gl, fragment_src, 'fragment');
      var vertex_src = "\n\
        attribute vec3 aVertexPosition;                                                                   \n\
        attribute vec3 aVertexNormal;                                                                     \n\
        attribute vec2 aTextureCoord;                                                                     \n\
                                                                                                          \n\
        uniform mat4 uMVMatrix;                                                                           \n\
        uniform mat4 uPMatrix;                                                                            \n\
        uniform mat4 uNMatrix;                                                                            \n\
                                                                                                          \n\
        uniform vec3 uAmbientColor;                                                                       \n\
                                                                                                          \n\
        uniform vec3 uLightingDirection;                                                                  \n\
        uniform vec3 uDirectionalColor;                                                                   \n\
                                                                                                          \n\
        uniform bool uUseLighting;                                                                        \n\
                                                                                                          \n\
        varying vec2 vTextureCoord;                                                                       \n\
        varying vec3 vLightWeighting;                                                                     \n\
                                                                                                          \n\
        void main(void) {                                                                                 \n\
          gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);                                \n\
          vTextureCoord = aTextureCoord;                                                                  \n\
                                                                                                          \n\
          if (!uUseLighting) {                                                                            \n\
            vLightWeighting = vec3(1.0, 1.0, 1.0);                                                        \n\
          } else {                                                                                        \n\
            vec4 transformedNormal = uNMatrix * vec4(aVertexNormal, 1.0);                                 \n\
            float directionalLightWeighting = max(dot(transformedNormal.xyz, uLightingDirection), 0.0);   \n\
            vLightWeighting = uAmbientColor + uDirectionalColor * directionalLightWeighting;              \n\
          }                                                                                               \n\
        }                                                                                                 \n\
      ";
      var vertexShader = getShader(gl, vertex_src, 'vertex');

      shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
      }

      gl.useProgram(shaderProgram);

      shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
      gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

      shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
      gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

      shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
      gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

      shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
      shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
      shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
      shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
      shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
      shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
      shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
      shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
    }


    function handleLoadedTexture(texture) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, texture.image, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.generateMipmap(gl.TEXTURE_2D);

      gl.bindTexture(gl.TEXTURE_2D, null);
    }


    var earthTexture;
    function initTexture() {
      earthTexture = gl.createTexture();
      earthTexture.image = new Image();
      earthTexture.image.onload = function() {
        handleLoadedTexture(earthTexture)
      }

      earthTexture.image.src = "earth2.jpg";
    }


    var mvMatrix;
    var mvMatrixStack = [];

    function mvPushMatrix(m) {
      if (m) {
        mvMatrixStack.push(m.dup());
        mvMatrix = m.dup();
      } else {
        mvMatrixStack.push(mvMatrix.dup());
      }
    }

    function mvPopMatrix() {
      if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
      }
      mvMatrix = mvMatrixStack.pop();
      return mvMatrix;
    }

    function loadIdentity() {
      mvMatrix = Matrix.I(4);
    }


    function multMatrix(m) {
      mvMatrix = mvMatrix.x(m);
    }


    function mvTranslate(v) {
      var m = Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4();
      multMatrix(m);
    }


    function createRotationMatrix(angle, v) {
      var arad = angle * Math.PI / 180.0;
      return Matrix.Rotation(arad, $V([v[0], v[1], v[2]])).ensure4x4();
    }


    function mvRotate(angle, v) {
      multMatrix(createRotationMatrix(angle, v));
    }


    var pMatrix;
    function perspective(fovy, aspect, znear, zfar) {
      pMatrix = makePerspective(fovy, aspect, znear, zfar);
    }


    function setMatrixUniforms() {
      gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, new WebGLFloatArray(pMatrix.flatten()));
      gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, new WebGLFloatArray(mvMatrix.flatten()));

      var normalMatrix = mvMatrix.inverse();
      normalMatrix = normalMatrix.transpose();
      gl.uniformMatrix4fv(shaderProgram.nMatrixUniform, false, new WebGLFloatArray(normalMatrix.flatten()));
    }

    var earthRotationMatrix = Matrix.I(4);

    var earthVertexPositionBuffer;
    var earthVertexNormalBuffer;
    var earthVertexTextureCoordBuffer;
    var earthVertexIndexBuffer;
    function initBuffers() {
      var latitudeBands = 30;
      var longitudeBands = 30;
      var radius = 2;

      var vertexPositionData = [];
      var normalData = [];
      var textureCoordData = [];
      for (var latNumber = 0; latNumber <= latitudeBands; latNumber++) {
        var theta = latNumber * Math.PI / latitudeBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var longNumber = 0; longNumber <= longitudeBands; longNumber++) {
          var phi = longNumber * 2 * Math.PI / longitudeBands;
          var sinPhi = Math.sin(phi);
          var cosPhi = Math.cos(phi);

          var x = cosPhi * sinTheta;
          var y = cosTheta;
          var z = sinPhi * sinTheta;
          var u = 1 - (longNumber / longitudeBands);
          var v = 1 - (latNumber / latitudeBands);

          normalData.push(x);
          normalData.push(y);
          normalData.push(z);
          textureCoordData.push(u);
          textureCoordData.push(v);
          vertexPositionData.push(radius * x);
          vertexPositionData.push(radius * y);
          vertexPositionData.push(radius * z);
        }
      }


      var indexData = [];
      for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {
        for (var longNumber = 0; longNumber < longitudeBands; longNumber++) {
          var first = (latNumber * (longitudeBands + 1)) + longNumber;
          var second = first + longitudeBands + 1;
          indexData.push(first);
          indexData.push(second);
          indexData.push(first + 1);

          indexData.push(second);
          indexData.push(second + 1);
          indexData.push(first + 1);
        }
      }

      earthVertexNormalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexNormalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new WebGLFloatArray(normalData), gl.STATIC_DRAW);
      earthVertexNormalBuffer.itemSize = 3;
      earthVertexNormalBuffer.numItems = normalData.length / 3;

      earthVertexTextureCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexTextureCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new WebGLFloatArray(textureCoordData), gl.STATIC_DRAW);
      earthVertexTextureCoordBuffer.itemSize = 2;
      earthVertexTextureCoordBuffer.numItems = textureCoordData.length / 2;

      earthVertexPositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexPositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new WebGLFloatArray(vertexPositionData), gl.STATIC_DRAW);
      earthVertexPositionBuffer.itemSize = 3;
      earthVertexPositionBuffer.numItems = vertexPositionData.length / 3;

      earthVertexIndexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, earthVertexIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new WebGLUnsignedShortArray(indexData), gl.STREAM_DRAW);
      earthVertexIndexBuffer.itemSize = 1;
      earthVertexIndexBuffer.numItems = indexData.length;
    }
    
    function drawScene() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      perspective(45, 1.0, 0.1, 100.0);
      
      var lighting = false;
      gl.uniform1i(shaderProgram.useLightingUniform, lighting);
      if (lighting) {
        gl.uniform3f(
          shaderProgram.ambientColorUniform,
          0.2,
          0.2,
          0.2
        );

        var lightingDirection = Vector.create([
          -1.0,
          -1.0,
          -1.0
        ]);
        var adjustedLD = lightingDirection.toUnitVector().x(-1);
        var flatLD = adjustedLD.flatten();
        gl.uniform3f(
          shaderProgram.lightingDirectionUniform,
          flatLD[0], flatLD[1], flatLD[2]
        );

        gl.uniform3f(
          shaderProgram.directionalColorUniform,
          0.8,
          0.8,
          0.8
        );
      }

      loadIdentity();

      mvTranslate([0, 0, -6]);

      multMatrix(earthRotationMatrix);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, earthTexture);
      gl.uniform1i(shaderProgram.samplerUniform, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexPositionBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, earthVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexTextureCoordBuffer);
      gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, earthVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, earthVertexNormalBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, earthVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, earthVertexIndexBuffer);
      setMatrixUniforms();
      gl.drawElements(gl.TRIANGLES, earthVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }


    function tick() {
      drawScene();
    }


    function init() {
      initGL();
      initShaders();
      initBuffers();
      initTexture();

      gl.clearColor(0.0, 0.0, 0.0, 1.0);

      gl.clearDepth(1.0);

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      setInterval(tick, 15);
    }
    
    init();
    
    var longitudeDifference;
    
    var currentLong = 0.0;
    var currentLat = 0.0;
    
    var setLatAndLong = function(latitude, longitude){
      var R_longitude = createRotationMatrix(-longitude, [0, 1, 0]);
      var R_latitude = createRotationMatrix(latitude, [1, 0, 0]);
      setCurrentLatLong(latitude, longitude)
      earthRotationMatrix = R_latitude.x(R_longitude.x(Matrix.I(4)));
    }
    
    var setCurrentLatLong = function(latitude, longitude){
      currentLat = latitude;
      currentLong = (longitude >= 360 ? longitude - 360 : longitude);
    }
    
    var spin = function(degrees){
      setLatAndLong(currentLat, currentLong+degrees);
    };
    
    function longDiff(newLong){
      if(newLong - currentLong < 0) newLong = newLong + 360.0;
      return (newLong - currentLong);
    }
    // Events
    var interval_id;
    this.bind('moveTo', function(evt, latitude, longitude, speed){
      if(interval_id) window.clearInterval(interval_id);
      interval_id = window.setInterval(function(){
        spin(0.2);
        if(longDiff(longitude) < 1) {
          window.clearInterval(interval_id);
        }
      }, 2);
    });
    
    return this;
  };
  
})(jQuery);
