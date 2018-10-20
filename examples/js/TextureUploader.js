THREE.TextureUploader = ( function () {

	function TextureUploader( renderer ) {

		this.frameCount = 0;
		this.interval = 1;
		this.mode = 'one_by_one';
		this.chunkSize = { width: 256, height: 256 };

		this.renderer = renderer;

		this.uploadQueue = [];
		this.createQueue = [];
		this.textureMap = new Map();

		this.defaultImageData = new ImageData( 1, 1 );
		this.onTextureUpload = function ( texture ) {}

		// renderer's capabilities and utils aren't exposed so having my own
		var gl = renderer.context;
		var extensions = new WebGLExtensions( gl );
		this.capabilities = new WebGLCapabilities( gl );
		this.utils = new THREE.WebGLUtils( gl, extensions, this.capabilities );

	}

	var COMMAND = {
		ALLOCATE_MEMORY: 0,
		CREATE_CHUNK: 1
	};

	TextureUploader.prototype = {

		isTextureUploader: true,

		// public methods

		setInterval: function ( interval ) {

			this.interval = interval;
			return this;

		},

		setMode: function ( mode ) {

			mode = mode.toLowerCase();

			if ( mode === this.mode ) return this;

			if ( this.uploadQueue.length > 0 || this.createQueue.length > 0 ) {

				console.warn( 'THREE.TextureUploader: You can not change mode while queues are not empty.' );
				return this;

			}

			if ( mode !== 'one_by_one' && mode !== 'at_the_same_time' && mode !== 'partial' && mode !== 'partial_no_interim' ) {

				console.warn( 'THREE.TextureUploader: mode must be one of one_by_one, at_the_same_time, partial, or partial_no_interim.' );
				return this;

			}

			this.mode = mode;
			return this;

		},

		setChunkSize: function ( width, height ) {

			if ( this.chunkSize.width === width && this.chunkSize.height === height ) return this;

			if ( this.uploadQueue.length > 0 || this.createQueue.length > 0 ) {

				console.warn( 'THREE.TextureUploader: You can not change chunkSize while queues are not empty.' );
				return this;

			}

			if ( ! this.isPowerOfTwoRect( width, height ) ) {

				console.warn( 'THREE.TextureUploader: You can not set non-power-of-two chunkSize.', width, height );
				return this;

			}

			this.chunkSize.width = width;
			this.chunkSize.height = height;
			return this;

		},

		setOnTextureUpload: function ( func ) {

			this.onTextureUpload = func;
			return this;

		},

		add: function ( object, recursive ) {

			if ( recursive !== false ) {

				var self = this;

				object.traverse( function ( obj ) {

					self.addObject( obj );

				} );

			} else {

				this.addObject( object );

			}

			return this;

		},

		update: function () {

			if ( ( this.frameCount ++ % this.interval ) !== 0 ) return;

			this.upload();
			this.create();

			return this;

		},

		// private methods

		upload: function () {

			if ( this.uploadQueue.length === 0 ) return;

			switch ( this.mode ) {

				case 'partial':
				case 'partial_no_interim':

					this.uploadChunk();
					break;

				case 'at_the_same_time':

					this.uploadAll();
					break;

				case 'one_by_one':
				default:

					this.uploadOne();
					break;

			}

		},

		create: function () {

			if ( this.createQueue.length === 0 ) return;

			var entry = this.createQueue.shift();

			switch ( entry.command ) {

				case COMMAND.ALLOCATE_MEMORY:

					this.allocateTextureMemory(
						entry.texture,
						entry.level,
						entry.width,
						entry.height
					);
					break;

				case COMMAND.CREATE_CHUNK:

					this.createChunk(
						entry.target,
						entry.imageBitmap,
						entry.sx,
						entry.sy,
						entry.sw,
						entry.sh,
						entry.level,
						entry.width,
						entry.height
					);
					break;

				default:

					console.error( 'THREE.TextureUploader: Unknown command: ' + entry.command );
					break;

			}

		},

		addObject: function ( object ) {

			if ( object.material === undefined ) return;

			this.addMaterial( object.material );

		},

		addMaterial: function ( material ) {

			for ( key in material ) {

				var element = material[ key ];

				if ( element !== null && typeof element === 'object' &&
					element.isTexture === true ) {

					this.addTexture( element );

				}

			}

		},

		addTexture: function ( texture ) {

			if ( this.textureMap.has( texture ) ) return;

			if ( this.mode === 'partial' || this.mode === 'partial_no_interim' ) {

				if ( texture.isCubeTexture === true ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support CubeTexture.', texture );
					return;

				}

				if ( texture.isCompressedTexture === true ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support CompressedTexture.', texture );
					return;

				}

				if ( texture.isDataTexture === true ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support DataTexture.', texture );
					return;

				}

				if ( texture.isDataTexture3D === true ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support DataTexture3D.', texture );
					return;

				}

				if ( texture.mipmaps.length > 0 ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support Texture whose .mipmaps.length > 0.', texture );
					return;

				}

				if ( texture.image === undefined || texture.image === null ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support Texture whose .image is not set.', texture );
					return;

				}

				if ( ! this.isPowerOfTwoRect( texture.image.width, texture.image.height ) ) {

					console.warn( 'THREE.TextureUploader: partial mode does not support Texture whose .image is not power-of-two.', texture );
					return;

				}

			}

			if ( texture.version === 0 ) {

				console.warn( 'THREE.TextureUploader: Add texture after running "texture.needsUpdate = true".', texture );
				return;

			}

			this.textureMap.set( texture, true );

			if ( this.mode === 'partial' || this.mode === 'partial_no_interim' ) {

				this.initializeTexture( texture );
				this.createChunks( texture );

			} else {

				texture.version --;

				this.uploadQueue.push( {
					texture: texture
				} );

			}

		},

		uploadAll: function () {

			while ( this.uploadQueue.length > 0 ) {

				this.uploadOne();

			}

		},

		uploadOne: function () {

			var entry = this.uploadQueue.shift();
			var texture = entry.texture;
			texture.needsUpdate = true;
			this.textureMap.delete( texture );
			this.onTextureUpload( texture );

		},

		uploadChunk: function () {

			var chunk = this.uploadQueue.shift();

			var gl = this.renderer.context;
			var srcTexture = chunk.src;
			var dstTexture = chunk.target;
			var width = srcTexture.image.width;
			var height = srcTexture.image.height;
			var glFormat = this.utils.convert( dstTexture.format );
			var glType = this.utils.convert( dstTexture.type );
			var level = chunk.level;
			var position = chunk.position;
			var webglTexture = dstTexture.webglTexture;

			gl.bindTexture( gl.TEXTURE_2D, webglTexture );
			gl.texSubImage2D( gl.TEXTURE_2D, level, position.x, position.y, glFormat, glType, srcTexture.image );
			gl.bindTexture( gl.TEXTURE_2D, null );

			dstTexture.uploadedChunks ++;

			if ( dstTexture.uploadedChunks === dstTexture.chunkNums ) {

				if ( this.mode === 'partial_no_interim' ) {

					this.switchWebGLTextures( dstTexture );

				}

				this.releaseTempProperties( dstTexture );
				this.onTextureUpload( dstTexture );

			}

		},

		switchWebGLTextures: function ( texture ) {

			var newWebGLTexture = texture.webglTexture;
			var oldWebGLTexture = this.renderer.properties.get( texture ).__webglTexture;
			var needsMipmaps = this.needsMipmaps( texture );
			var width = texture.image.width;
			var height = texture.image.height;

			renderer.properties.get( texture ).__webglTexture = newWebGLTexture;
			renderer.properties.get( texture ).__maxMipLevel = needsMipmaps ? Math.log( Math.max( width, height ) ) * Math.LOG2E : 0;

			var gl = this.renderer.context;
			gl.deleteTexture( oldWebGLTexture );

		},

		releaseTempProperties: function ( texture ) {

			delete texture.webglTexture;
			delete texture.uploadedChunks;

		},

		createChunks: function ( texture ) {

			var image = texture.image;
			var width = image.width;
			var height = image.height;
			var level = 0;
			var needsMipmaps = this.needsMipmaps( texture );

			texture.chunkNums = 0;
			texture.uploadedChunks = 0;

			while ( true ) {

				this.createChunksForLevel( texture, width, height, level );

				if ( ! needsMipmaps || ( width === 1 && height === 1 ) ) break;

				width = Math.max( ( width / 2 ) | 0, 1 );
				height = Math.max( ( height / 2 ) | 0, 1 );
				level ++;

			}

		},

		createChunksForLevel: function ( texture, width, height, level ) {

			var image = texture.image;
			var pending;

			if ( image.width !== width || image.height !== height ) {

				pending = createImageBitmap( image, {
					resizeWidth: width,
					resizeHeight: height
				} );

			} else {

				pending = Promise.resolve( image );

			}

			texture.chunkNums += Math.max( 1, ( width / this.chunkSize.width ) | 0 ) * Math.max( 1, ( height / this.chunkSize.height ) | 0 );

			var self = this;

			pending.then( function ( imageBitmap ) {

				var sx = 0;
				var sy = 0;

				var sw = Math.min( self.chunkSize.width, width );
				var sh = Math.min( self.chunkSize.height, height );

				while ( sy < height ) {

					self.createQueue.push( {
						command: COMMAND.CREATE_CHUNK,
						target: texture,
						imageBitmap: imageBitmap,
						sx: sx,
						sy: sy,
						sw: sw,
						sh: sh,
						level: level,
						width: width,
						height: height
					} );

					sx += sw;

					if ( sx >= width ) {

						sx = 0;
						sy += sh;

					}

				}

			} );

		},

		createChunk: function ( texture, imageBitmap, sx, sy, sw, sh, level ) {

			var self = this;

			createImageBitmap( imageBitmap, sx, sy, sw, sh ).then( chunkBitmap => {

				var srcTexture = texture.clone();
				srcTexture.image = chunkBitmap;

				self.uploadQueue.push( {
					position: new THREE.Vector2( sx, sy ),
					src: srcTexture,
					target: texture,
					level: level
				} );

			} );

		},

		initializeTexture: function ( texture ) {

			var currentImage = texture.image;

			texture.image = this.defaultImageData;
			texture.needsUpdate = true;

			this.renderer.setTexture2D( texture, 0 );

			texture.image = currentImage;

			var gl = this.renderer.context;
			texture.webglTexture = gl.createTexture();

			var width = currentImage.width;
			var height = currentImage.height;
			var level = 0;
			var needsMipmaps = this.needsMipmaps( texture );

			texture.levelNums = 0;
			texture.allocatedLevels = 0;

			while ( true ) {

				this.createQueue.push( {
					command: COMMAND.ALLOCATE_MEMORY,
					texture: texture,
					level: level,
					width: width,
					height: height
				} );

				texture.levelNums ++;

				if ( ! needsMipmaps || ( width === 1 && height === 1 ) ) break;

				width = Math.max( 1, ( width / 2 ) | 0 );
				height = Math.max( 1, ( height / 2 ) | 0 );
				level ++;

			}

		},

		allocateTextureMemory: function ( texture, level, width, height ) {

			var image = texture.image;

			var gl = this.renderer.context;
			var webglTexture = texture.webglTexture;

			var glFormat = this.utils.convert( texture.format );
			var glType = this.utils.convert( texture.type );
			var glInternalFormat = this.getInternalFormat( glFormat, glType );

			gl.bindTexture( gl.TEXTURE_2D, webglTexture );
			gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, texture.flipY );
			gl.pixelStorei( gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha );
			gl.pixelStorei( gl.UNPACK_ALIGNMENT, texture.unpackAlignment );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.utils.convert( texture.wrapS ) );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.utils.convert( texture.wrapS ) );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.utils.convert( texture.magFilter ) );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.utils.convert( texture.minFilter ) );
			gl.texImage2D( gl.TEXTURE_2D, level, glInternalFormat, width, height, 0, glFormat, glType, null );
			gl.bindTexture( gl.TEXTURE_2D, null );

			texture.allocatedLevels ++;

			if ( this.mode === 'partial' && texture.allocatedLevels === texture.levelNums ) {

				this.switchWebGLTextures( texture );

			}

		},

		isPowerOfTwoRect: function ( width, height ) {

			return THREE.Math.isPowerOfTwo( width ) && THREE.Math.isPowerOfTwo( height );

		},

		needsMipmaps: function ( texture ) {

			return texture.generateMipmaps &&
				texture.minFilter !== THREE.NearestFilter &&
				texture.minFilter !== THREE.LinearFilter;

		},

		// renderer's getInternalFormat isn't exposed so having my own
		getInternalFormat: function ( glFormat, glType ) {

			if ( ! this.capabilities.isWebGL2 ) return glFormat;

			var gl = this.renderer.context;

			if ( glFormat === gl.RED ) {

				if ( glType === gl.FLOAT ) return gl.R32F;
				if ( glType === gl.HALF_FLOAT ) return gl.R16F
				if ( glType === gl.UNSIGNED_BYTE ) return gl.R8;

			}

                        if ( glFormat === gl.RGB ) {

                                if ( glType === gl.FLOAT ) return gl.RGB32F;
                                if ( glType === gl.HALF_FLOAT ) return gl.RGB16F
                                if ( glType === gl.UNSIGNED_BYTE ) return gl.RGB8;

                        }

                        if ( glFormat === gl.RGBA ) {

                                if ( glType === gl.FLOAT ) return _gl.RGBA32F;
                                if ( glType === gl.HALF_FLOAT ) return _gl.RGBA16F;
                                if ( glType === gl.UNSIGNED_BYTE ) return _gl.RGBA8;

                        }

                        return glFormat;

		}

	};

	function WebGLExtensions( gl ) {

		var extensions = {};

		return {

			get: function ( name ) {

				if ( extensions[ name ] !== undefined ) {

					return extensions[ name ];

				}

				var extension;

				switch ( name ) {

					case 'WEBGL_depth_texture':
						extension = gl.getExtension( 'WEBGL_depth_texture' ) || gl.getExtension( 'MOZ_WEBGL_depth_texture' ) || gl.getExtension( 'WEBKIT_WEBGL_depth_texture' );
						break;

					case 'EXT_texture_filter_anisotropic':
						extension = gl.getExtension( 'EXT_texture_filter_anisotropic' ) || gl.getExtension( 'MOZ_EXT_texture_filter_anisotropic' ) || gl.getExtension( 'WEBKIT_EXT_texture_filter_anisotropic' );
						break;

					case 'WEBGL_compressed_texture_s3tc':
						extension = gl.getExtension( 'WEBGL_compressed_texture_s3tc' ) || gl.getExtension( 'MOZ_WEBGL_compressed_texture_s3tc' ) || gl.getExtension( 'WEBKIT_WEBGL_compressed_texture_s3tc' );
						break;

					case 'WEBGL_compressed_texture_pvrtc':
						extension = gl.getExtension( 'WEBGL_compressed_texture_pvrtc' ) || gl.getExtension( 'WEBKIT_WEBGL_compressed_texture_pvrtc' );
						break;

					default:
						extension = gl.getExtension( name );

				}

				if ( extension === null ) {

					console.warn( 'THREE.WebGLRenderer: ' + name + ' extension not supported.' );

				}

				extensions[ name ] = extension;

				return extension;

			}

		};

	}

	function WebGLCapabilities( gl ) {

		var isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

		return {

			isWebGL2: isWebGL2

		};

	}

	return TextureUploader;

} )();
