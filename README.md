# THREE.TextureUploader

Less-blocking Texture uploader for Three.js

## Requirement

- Chrome (because FireFox has ImageBitmap bugs)
- Enable Experimental Web Platform features via chrome://flags
- Three.js r97 or newer

## Demo

### Regular textures (five 2048x2048 jpg textures)

- [Original for comparison](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time)
- [One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&interval=30)
- [Partial](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial&chunksize=512)
- [ImageBitmapLoader](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time&imagebitmap=on)
- [ImageBitmapLoader + One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&imagebitmap=on&interval=30)
- [ImageBitmapLoader + Partial](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial&imagebitmap=on&chunksize=512&interval=3)
- [ImageBitmapLoader + Partial(No interim)](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial_no_interim&imagebitmap=on&chunksize=512&interval=3)
- [Runtime DXT1 convertion](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=dxt1&imagebitmap=on&interval=10)

### Large textures (five 4096x4096 jpg textures)

- [Original for comparison](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time&texture=large)
- [One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&interval=30&texture=large)
- [Partial](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial&chunksize=512&texture=large)
- [ImageBitmapLoader](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time&imagebitmap=on&texture=large)
- [ImageBitmapLoader + One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&imagebitmap=on&interval=30&texture=large)
- [ImageBitmapLoader + Partial](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial&imagebitmap=on&chunksize=512&interval=3&texture=large)
- [ImageBitmapLoader + Partial(No interim)](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial_no_interim&imagebitmap=on&chunksize=512&interval=3&texture=large)
- [Runtime DXT1 convertion](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=dxt1&imagebitmap=on&interval=10&texture=large)

### Huge textures (five 8192x8192 jpg textures)

- [Original for comparison](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time&texture=huge)
- [One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&interval=30&texture=huge)
- [Partial](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial&chunksize=512&texture=huge)
- [ImageBitmapLoader](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time&imagebitmap=on&texture=huge)
- [ImageBitmapLoader + One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&imagebitmap=on&interval=30&texture=huge)
- [ImageBitmapLoader + Partial](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial&imagebitmap=on&chunksize=512&interval=3&texture=huge)
- [ImageBitmapLoader + Partial(No interim)](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=partial_no_interim&imagebitmap=on&chunksize=512&interval=3&texture=huge)
- [Runtime DXT1 convertion](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=dxt1&imagebitmap=on&interval=10&texture=huge)

### DDS textures (five 8192x8192 DXT1 textures)

- [Original for comparison](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=at_the_same_time&texture=dds)
- [One_by_one](https://raw.githack.com/takahirox/THREE.TextureUploader/master/examples/webgl_texture_uploader.html?mode=one_by_one&interval=30&texture=dds)

## How to use

```html
<script src="../build/three.js"></script>
<script src="js/TextureUploader.js"></script>
<script src="js/loaders/GLTFLoader.js"></script>

<script>
// Override TextureLoader to use ImageBitmapLoader
THREE.TextureLoader.prototype.load = function ( url, onLoad, onProgress, onError ) {

  var texture = new THREE.Texture();

  var loader = new THREE.ImageBitmapLoader( this.manager );
  loader.setCrossOrigin( this.crossOrigin );
  loader.setPath( this.path );

  loader.load( url, function ( image ) {

    texture.image = image;

    var isJPEG = url.search( /\.jpe?g$/i ) > 0 || url.search( /^data\:image\/jpeg/ ) === 0;

    texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat
    texture.needsUpdate = true;

    if ( onLoad !== undefined ) {

      onLoad( texture );

    }

  }, onProgress, onError );

  return texture;

};

var container = document.createElement( 'div' );
document.body.appendChild( container );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 2000 );

var renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.gammaOutput = true;
container.appendChild( renderer.domElement );

var uploader = new THREE.TextureUploader( renderer )
  .setChunkSize( 512, 512 )
  .setInterval( 3 )
  .setMode( 'partial' );

var loader = new THREE.GLTFLoader();
loader.load( url, function ( gltf ) {

  uploader.add( gltf.scene );
  scene.add( gltf.scene );

} );

function animate() {

  requestAnimationFrame( animate );
  uploader.update();
  renderer.render( scene, camera );

}

animate();
</script>
```

## API

T.B.D.

## Less blocking texture upload TIPs

T.B.D.
