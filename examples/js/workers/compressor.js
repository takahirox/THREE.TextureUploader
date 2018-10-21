importScripts( './squish.js' );

var GetStorageRequirements = Module.cwrap(
	'GetStorageRequirements',
	'number',
	[ 'number', 'number', 'number' ]
);

var CompressImage = Module.cwrap(
	'CompressImage',
	 'void', 
	[ 'number', 'number', 'number', 'number', 'number' ]
);

onmessage = function ( e ) {

	compress( e.data.arg );

};

function onCompressDone( data ) {

	postMessage( {
		command: 'compress',
		data: data
	}, [ data.array.buffer ] );

}

function compress( arg, flags ) {

	var pending;

	if ( typeof arg === 'string' ) {

		pending = compressFromUrl( arg, flags );

	} else if ( arg instanceof ImageBitmap ) {

		pending = compressImageBitmap( arg, flags );

	} else if ( arg instanceof ImageData ) {

		pending = compressImageData( arg, flags );

	} else {

		pending = Promise.resolve( {} );

	}

	pending.then( function ( result ) {

		onCompressDone( result );

	} );

}

function compressFromUrl( url, flags ) {

	return fetch( url ).then( function ( res ) {

		return res.blob();

	} ).then( function ( blob ) {

		return createImageBitmap( blob );

	} ).then( function ( bitmap ) {

		return compressImage( bitmap, flags );

	} );

}

function compressImageBitmap( bitmap, flags ) {

	var width = bitmap.width;
	var height = bitmap.height;
	var canvas = new OffscreenCanvas( width, height );
	var context = canvas.getContext( '2d' );
	context.drawImage( bitmap, 0, 0, width, height );
	return compressImageData( context.getImageData( 0, 0, width, height ), flags );

}

function compressImageData( imageData, flags ) {

	flags = flags || ( ( 1 << 4 ) | 1 );

	var inputData = imageData.data;
	var width = imageData.width;
	var height = imageData.height;

	var sourcePointer = Module._malloc( width * height * 4 );
	Module.HEAPU8.set( inputData, sourcePointer );

	var outputSize = GetStorageRequirements( width, height, flags );
	var distPointer = Module._malloc( outputSize );

	console.time( 'compression' );
	CompressImage( sourcePointer, width, height, distPointer, flags );
	console.timeEnd( 'compression' );

	var outputData = new Uint8Array( Module.HEAPU8.buffer, distPointer, outputSize );

	Module._free( distPointer );
	Module._free( sourcePointer );

	return Promise.resolve( {
		array: outputData,
		width: width,
		height: height
	} );

}
