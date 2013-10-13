/*
PIE: CSS3 rendering for IE
Version 1.0.0
http://css3pie.com
Dual-licensed for use under the Apache License Version 2.0 or the General Public License (GPL) Version 2.
*/
(function(){
var doc = document;var PIE = window['PIE'];

if( !PIE ) {
    PIE = window['PIE'] = {
        CSS_PREFIX: '-pie-',
        STYLE_PREFIX: 'Pie',
        CLASS_PREFIX: 'pie_',
        tableCellTags: {
            'TD': 1,
            'TH': 1
        },

        /**
         * Lookup table of elements which cannot take custom children.
         */
        childlessElements: {
            'TABLE':1,
            'THEAD':1,
            'TBODY':1,
            'TFOOT':1,
            'TR':1,
            'INPUT':1,
            'TEXTAREA':1,
            'SELECT':1,
            'OPTION':1,
            'IMG':1,
            'HR':1
        },

        /**
         * Elements that can receive user focus
         */
        focusableElements: {
            'A':1,
            'INPUT':1,
            'TEXTAREA':1,
            'SELECT':1,
            'BUTTON':1
        },

        /**
         * Values of the type attribute for input elements displayed as buttons
         */
        inputButtonTypes: {
            'submit':1,
            'button':1,
            'reset':1
        },

        emptyFn: function() {}
    };

    // Force the background cache to be used. No reason it shouldn't be.
    try {
        doc.execCommand( 'BackgroundImageCache', false, true );
    } catch(e) {}

    (function() {
        /*
         * IE version detection approach by James Padolsey, with modifications -- from
         * http://james.padolsey.com/javascript/detect-ie-in-js-using-conditional-comments/
         */
        var ieVersion = 4,
            div = doc.createElement('div'),
            all = div.getElementsByTagName('i'),
            shape;
        while (
            div.innerHTML = '<!--[if gt IE ' + (++ieVersion) + ']><i></i><![endif]-->',
            all[0]
        ) {}
        PIE.ieVersion = ieVersion;

        // Detect IE6
        if( ieVersion === 6 ) {
            // IE6 can't access properties with leading dash, but can without it.
            PIE.CSS_PREFIX = PIE.CSS_PREFIX.replace( /^-/, '' );
        }

        PIE.ieDocMode = doc.documentMode || PIE.ieVersion;

        // Detect VML support (a small number of IE installs don't have a working VML engine)
        div.innerHTML = '<v:shape adj="1"/>';
        shape = div.firstChild;
        shape.style['behavior'] = 'url(#default#VML)';
        PIE.supportsVML = (typeof shape['adj'] === "object");
    }());
/**
 * Utility functions
 */
(function() {
    var vmlCreatorDoc,
        idNum = 0,
        imageSizes = {};


    PIE.Util = {

        /**
         * To create a VML element, it must be created by a Document which has the VML
         * namespace set. Unfortunately, if you try to add the namespace programatically
         * into the main document, you will get an "Unspecified error" when trying to
         * access document.namespaces before the document is finished loading. To get
         * around this, we create a DocumentFragment, which in IE land is apparently a
         * full-fledged Document. It allows adding namespaces immediately, so we add the
         * namespace there and then have it create the VML element.
         * @param {string} tag The tag name for the VML element
         * @return {Element} The new VML element
         */
        createVmlElement: function( tag ) {
            var vmlPrefix = 'css3vml';
            if( !vmlCreatorDoc ) {
                vmlCreatorDoc = doc.createDocumentFragment();
                vmlCreatorDoc.namespaces.add( vmlPrefix, 'urn:schemas-microsoft-com:vml' );
            }
            return vmlCreatorDoc.createElement( vmlPrefix + ':' + tag );
        },


        /**
         * Generate and return a unique ID for a given object. The generated ID is stored
         * as a property of the object for future reuse.
         * @param {Object} obj
         */
        getUID: function( obj ) {
            return obj && obj[ '_pieId' ] || ( obj[ '_pieId' ] = '_' + ++idNum );
        },


        /**
         * Simple utility for merging objects
         * @param {Object} obj1 The main object into which all others will be merged
         * @param {...Object} var_args Other objects which will be merged into the first, in order
         */
        merge: function( obj1 ) {
            var i, len, p, objN, args = arguments;
            for( i = 1, len = args.length; i < len; i++ ) {
                objN = args[i];
                for( p in objN ) {
                    if( objN.hasOwnProperty( p ) ) {
                        obj1[ p ] = objN[ p ];
                    }
                }
            }
            return obj1;
        },


        /**
         * Execute a callback function, passing it the dimensions of a given image once
         * they are known.
         * @param {string} src The source URL of the image
         * @param {function({w:number, h:number})} func The callback function to be called once the image dimensions are known
         * @param {Object} ctx A context object which will be used as the 'this' value within the executed callback function
         */
        withImageSize: function( src, func, ctx ) {
            var size = imageSizes[ src ], img, queue;
            if( size ) {
                // If we have a queue, add to it
                if( Object.prototype.toString.call( size ) === '[object Array]' ) {
                    size.push( [ func, ctx ] );
                }
                // Already have the size cached, call func right away
                else {
                    func.call( ctx, size );
                }
            } else {
                queue = imageSizes[ src ] = [ [ func, ctx ] ]; //create queue
                img = new Image();
                img.onload = function() {
                    size = imageSizes[ src ] = { w: img.width, h: img.height };
                    for( var i = 0, len = queue.length; i < len; i++ ) {
                        queue[ i ][ 0 ].call( queue[ i ][ 1 ], size );
                    }
                    img.onload = null;
                };
                img.src = src;
            }
        }
    };
})();/**
 * Utility functions for handling gradients
 */
PIE.GradientUtil = {

    getGradientMetrics: function( el, width, height, gradientInfo ) {
        var angle = gradientInfo.angle,
            startPos = gradientInfo.gradientStart,
            startX, startY,
            endX, endY,
            startCornerX, startCornerY,
            endCornerX, endCornerY,
            deltaX, deltaY,
            p, UNDEF;

        // Find the "start" and "end" corners; these are the corners furthest along the gradient line.
        // This is used below to find the start/end positions of the CSS3 gradient-line, and also in finding
        // the total length of the VML rendered gradient-line corner to corner.
        function findCorners() {
            startCornerX = ( angle >= 90 && angle < 270 ) ? width : 0;
            startCornerY = angle < 180 ? height : 0;
            endCornerX = width - startCornerX;
            endCornerY = height - startCornerY;
        }

        // Normalize the angle to a value between [0, 360)
        function normalizeAngle() {
            while( angle < 0 ) {
                angle += 360;
            }
            angle = angle % 360;
        }

        // Find the start and end points of the gradient
        if( startPos ) {
            startPos = startPos.coords( el, width, height );
            startX = startPos.x;
            startY = startPos.y;
        }
        if( angle ) {
            angle = angle.degrees();

            normalizeAngle();
            findCorners();

            // If no start position was specified, then choose a corner as the starting point.
            if( !startPos ) {
                startX = startCornerX;
                startY = startCornerY;
            }

            // Find the end position by extending a perpendicular line from the gradient-line which
            // intersects the corner opposite from the starting corner.
            p = PIE.GradientUtil.perpendicularIntersect( startX, startY, angle, endCornerX, endCornerY );
            endX = p[0];
            endY = p[1];
        }
        else if( startPos ) {
            // Start position but no angle specified: find the end point by rotating 180deg around the center
            endX = width - startX;
            endY = height - startY;
        }
        else {
            // Neither position nor angle specified; create vertical gradient from top to bottom
            startX = startY = endX = 0;
            endY = height;
        }
        deltaX = endX - startX;
        deltaY = endY - startY;

        if( angle === UNDEF ) {
            // Get the angle based on the change in x/y from start to end point. Checks first for horizontal
            // or vertical angles so they get exact whole numbers rather than what atan2 gives.
            angle = ( !deltaX ? ( deltaY < 0 ? 90 : 270 ) :
                        ( !deltaY ? ( deltaX < 0 ? 180 : 0 ) :
                            -Math.atan2( deltaY, deltaX ) / Math.PI * 180
                        )
                    );
            normalizeAngle();
            findCorners();
        }

        return {
            angle: angle,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            startCornerX: startCornerX,
            startCornerY: startCornerY,
            endCornerX: endCornerX,
            endCornerY: endCornerY,
            deltaX: deltaX,
            deltaY: deltaY,
            lineLength: PIE.GradientUtil.distance( startX, startY, endX, endY )
        }
    },

    /**
     * Find the point along a given line (defined by a starting point and an angle), at which
     * that line is intersected by a perpendicular line extending through another point.
     * @param x1 - x coord of the starting point
     * @param y1 - y coord of the starting point
     * @param angle - angle of the line extending from the starting point (in degrees)
     * @param x2 - x coord of point along the perpendicular line
     * @param y2 - y coord of point along the perpendicular line
     * @return [ x, y ]
     */
    perpendicularIntersect: function( x1, y1, angle, x2, y2 ) {
        // Handle straight vertical and horizontal angles, for performance and to avoid
        // divide-by-zero errors.
        if( angle === 0 || angle === 180 ) {
            return [ x2, y1 ];
        }
        else if( angle === 90 || angle === 270 ) {
            return [ x1, y2 ];
        }
        else {
            // General approach: determine the Ax+By=C formula for each line (the slope of the second
            // line is the negative inverse of the first) and then solve for where both formulas have
            // the same x/y values.
            var a1 = Math.tan( -angle * Math.PI / 180 ),
                c1 = a1 * x1 - y1,
                a2 = -1 / a1,
                c2 = a2 * x2 - y2,
                d = a2 - a1,
                endX = ( c2 - c1 ) / d,
                endY = ( a1 * c2 - a2 * c1 ) / d;
            return [ endX, endY ];
        }
    },

    /**
     * Find the distance between two points
     * @param {Number} p1x
     * @param {Number} p1y
     * @param {Number} p2x
     * @param {Number} p2y
     * @return {Number} the distance
     */
    distance: function( p1x, p1y, p2x, p2y ) {
        var dx = p2x - p1x,
            dy = p2y - p1y;
        return Math.abs(
            dx === 0 ? dy :
            dy === 0 ? dx :
            Math.sqrt( dx * dx + dy * dy )
        );
    }

};/**
 * 
 */
PIE.Observable = function() {
    /**
     * List of registered observer functions
     */
    this.observers = [];

    /**
     * Hash of function ids to their position in the observers list, for fast lookup
     */
    this.indexes = {};
};
PIE.Observable.prototype = {

    observe: function( fn ) {
        var id = PIE.Util.getUID( fn ),
            indexes = this.indexes,
            observers = this.observers;
        if( !( id in indexes ) ) {
            indexes[ id ] = observers.length;
            observers.push( fn );
        }
    },

    unobserve: function( fn ) {
        var id = PIE.Util.getUID( fn ),
            indexes = this.indexes;
        if( id && id in indexes ) {
            delete this.observers[ indexes[ id ] ];
            delete indexes[ id ];
        }
    },

    fire: function() {
        var o = this.observers,
            i = o.length;
        while( i-- ) {
            o[ i ] && o[ i ]();
        }
    }

};/*
 * Simple heartbeat timer - this is a brute-force workaround for syncing issues caused by IE not
 * always firing the onmove and onresize events when elements are moved or resized. We check a few
 * times every second to make sure the elements have the correct position and size. See Element.js
 * which adds heartbeat listeners based on the custom -pie-poll flag, which defaults to true in IE8-9
 * and false elsewhere.
 */

PIE.Heartbeat = new PIE.Observable();
PIE.Heartbeat.run = function() {
    var me = this,
        interval;
    if( !me.running ) {
        interval = doc.documentElement.currentStyle.getAttribute( PIE.CSS_PREFIX + 'poll-interval' ) || 250;
        (function beat() {
            me.fire();
            setTimeout(beat, interval);
        })();
        me.running = 1;
    }
};
/**
 * Create an observable listener for the onunload event
 */
(function() {
    PIE.OnUnload = new PIE.Observable();

    function handleUnload() {
        PIE.OnUnload.fire();
        window.detachEvent( 'onunload', handleUnload );
        window[ 'PIE' ] = null;
    }

    window.attachEvent( 'onunload', handleUnload );

    /**
     * Attach an event which automatically gets detached onunload
     */
    PIE.OnUnload.attachManagedEvent = function( target, name, handler ) {
        target.attachEvent( name, handler );
        this.observe( function() {
            target.detachEvent( name, handler );
        } );
    };
})()/**
 * Create a single observable listener for window resize events.
 */
PIE.OnResize = new PIE.Observable();

PIE.OnUnload.attachManagedEvent( window, 'onresize', function() { PIE.OnResize.fire(); } );
/**
 * Create a single observable listener for scroll events. Used for lazy loading based
 * on the viewport, and for fixed position backgrounds.
 */
(function() {
    PIE.OnScroll = new PIE.Observable();

    function scrolled() {
        PIE.OnScroll.fire();
    }

    PIE.OnUnload.attachManagedEvent( window, 'onscroll', scrolled );

    PIE.OnResize.observe( scrolled );
})();
/**
 * Listen for printing events, destroy all active PIE instances when printing, and
 * restore them afterward.
 */
(function() {

    var elements;

    function beforePrint() {
        elements = PIE.Element.destroyAll();
    }

    function afterPrint() {
        if( elements ) {
            for( var i = 0, len = elements.length; i < len; i++ ) {
                PIE[ 'attach' ]( elements[i] );
            }
            elements = 0;
        }
    }

    if( PIE.ieDocMode < 9 ) {
        PIE.OnUnload.attachManagedEvent( window, 'onbeforeprint', beforePrint );
        PIE.OnUnload.attachManagedEvent( window, 'onafterprint', afterPrint );
    }

})();/**
 * Create a single observable listener for document mouseup events.
 */
PIE.OnMouseup = new PIE.Observable();

PIE.OnUnload.attachManagedEvent( doc, 'onmouseup', function() { PIE.OnMouseup.fire(); } );
/**
 * Wrapper for length and percentage style values. The value is immutable. A singleton instance per unique
 * value is returned from PIE.getLength() - always use that instead of instantiating directly.
 * @constructor
 * @param {string} val The CSS string representing the length. It is assumed that this will already have
 *                 been validated as a valid length or percentage syntax.
 */
PIE.Length = (function() {
    var lengthCalcEl = doc.createElement( 'length-calc' ),
        parent = doc.body || doc.documentElement,
        s = lengthCalcEl.style,
        conversions = {},
        units = [ 'mm', 'cm', 'in', 'pt', 'pc' ],
        i = units.length,
        instances = {};

    s.position = 'absolute';
    s.top = s.left = '-9999px';

    parent.appendChild( lengthCalcEl );
    while( i-- ) {
        s.width = '100' + units[i];
        conversions[ units[i] ] = lengthCalcEl.offsetWidth / 100;
    }
    parent.removeChild( lengthCalcEl );

    // All calcs from here on will use 1em
    s.width = '1em';


    function Length( val ) {
        this.val = val;
    }
    Length.prototype = {
        /**
         * Regular expression for matching the length unit
         * @private
         */
        unitRE: /(px|em|ex|mm|cm|in|pt|pc|%)$/,

        /**
         * Get the numeric value of the length
         * @return {number} The value
         */
        getNumber: function() {
            var num = this.num,
                UNDEF;
            if( num === UNDEF ) {
                num = this.num = parseFloat( this.val );
            }
            return num;
        },

        /**
         * Get the unit of the length
         * @return {string} The unit
         */
        getUnit: function() {
            var unit = this.unit,
                m;
            if( !unit ) {
                m = this.val.match( this.unitRE );
                unit = this.unit = ( m && m[0] ) || 'px';
            }
            return unit;
        },

        /**
         * Determine whether this is a percentage length value
         * @return {boolean}
         */
        isPercentage: function() {
            return this.getUnit() === '%';
        },

        /**
         * Resolve this length into a number of pixels.
         * @param {Element} el - the context element, used to resolve font-relative values
         * @param {(function():number|number)=} pct100 - the number of pixels that equal a 100% percentage. This can be either a number or a
         *                  function which will be called to return the number.
         */
        pixels: function( el, pct100 ) {
            var num = this.getNumber(),
                unit = this.getUnit();
            switch( unit ) {
                case "px":
                    return num;
                case "%":
                    return num * ( typeof pct100 === 'function' ? pct100() : pct100 ) / 100;
                case "em":
                    return num * this.getEmPixels( el );
                case "ex":
                    return num * this.getEmPixels( el ) / 2;
                default:
                    return num * conversions[ unit ];
            }
        },

        /**
         * The em and ex units are relative to the font-size of the current element,
         * however if the font-size is set using non-pixel units then we get that value
         * rather than a pixel conversion. To get around this, we keep a floating element
         * with width:1em which we insert into the target element and then read its offsetWidth.
         * For elements that won't accept a child we insert into the parent node and perform
         * additional calculation. If the font-size *is* specified in pixels, then we use that
         * directly to avoid the expensive DOM manipulation.
         * @param {Element} el
         * @return {number}
         */
        getEmPixels: function( el ) {
            var fs = el.currentStyle.fontSize,
                px, parent, me;

            if( fs.indexOf( 'px' ) > 0 ) {
                return parseFloat( fs );
            }
            else if( el.tagName in PIE.childlessElements ) {
                me = this;
                parent = el.parentNode;
                return PIE.getLength( fs ).pixels( parent, function() {
                    return me.getEmPixels( parent );
                } );
            }
            else {
                el.appendChild( lengthCalcEl );
                px = lengthCalcEl.offsetWidth;
                if( lengthCalcEl.parentNode === el ) { //not sure how this could be false but it sometimes is
                    el.removeChild( lengthCalcEl );
                }
                return px;
            }
        }
    };


    /**
     * Retrieve a PIE.Length instance for the given value. A shared singleton instance is returned for each unique value.
     * @param {string} val The CSS string representing the length. It is assumed that this will already have
     *                 been validated as a valid length or percentage syntax.
     */
    PIE.getLength = function( val ) {
        return instances[ val ] || ( instances[ val ] = new Length( val ) );
    };

    return Length;
})();
/**
 * Wrapper for a CSS3 bg-position value. Takes up to 2 position keywords and 2 lengths/percentages.
 * @constructor
 * @param {Array.<PIE.Tokenizer.Token>} tokens The tokens making up the background position value.
 */
PIE.BgPosition = (function() {

    var length_fifty = PIE.getLength( '50%' ),
        vert_idents = { 'top': 1, 'center': 1, 'bottom': 1 },
        horiz_idents = { 'left': 1, 'center': 1, 'right': 1 };


    function BgPosition( tokens ) {
        this.tokens = tokens;
    }
    BgPosition.prototype = {
        /**
         * Normalize the values into the form:
         * [ xOffsetSide, xOffsetLength, yOffsetSide, yOffsetLength ]
         * where: xOffsetSide is either 'left' or 'right',
         *        yOffsetSide is either 'top' or 'bottom',
         *        and x/yOffsetLength are both PIE.Length objects.
         * @return {Array}
         */
        getValues: function() {
            if( !this._values ) {
                var tokens = this.tokens,
                    len = tokens.length,
                    Tokenizer = PIE.Tokenizer,
                    identType = Tokenizer.Type,
                    length_zero = PIE.getLength( '0' ),
                    type_ident = identType.IDENT,
                    type_length = identType.LENGTH,
                    type_percent = identType.PERCENT,
                    type, value,
                    vals = [ 'left', length_zero, 'top', length_zero ];

                // If only one value, the second is assumed to be 'center'
                if( len === 1 ) {
                    tokens.push( new Tokenizer.Token( type_ident, 'center' ) );
                    len++;
                }

                // Two values - CSS2
                if( len === 2 ) {
                    // If both idents, they can appear in either order, so switch them if needed
                    if( type_ident & ( tokens[0].tokenType | tokens[1].tokenType ) &&
                        tokens[0].tokenValue in vert_idents && tokens[1].tokenValue in horiz_idents ) {
                        tokens.push( tokens.shift() );
                    }
                    if( tokens[0].tokenType & type_ident ) {
                        if( tokens[0].tokenValue === 'center' ) {
                            vals[1] = length_fifty;
                        } else {
                            vals[0] = tokens[0].tokenValue;
                        }
                    }
                    else if( tokens[0].isLengthOrPercent() ) {
                        vals[1] = PIE.getLength( tokens[0].tokenValue );
                    }
                    if( tokens[1].tokenType & type_ident ) {
                        if( tokens[1].tokenValue === 'center' ) {
                            vals[3] = length_fifty;
                        } else {
                            vals[2] = tokens[1].tokenValue;
                        }
                    }
                    else if( tokens[1].isLengthOrPercent() ) {
                        vals[3] = PIE.getLength( tokens[1].tokenValue );
                    }
                }

                // Three or four values - CSS3
                else {
                    // TODO
                }

                this._values = vals;
            }
            return this._values;
        },

        /**
         * Find the coordinates of the background image from the upper-left corner of the background area.
         * Note that these coordinate values are not rounded.
         * @param {Element} el
         * @param {number} width - the width for percentages (background area width minus image width)
         * @param {number} height - the height for percentages (background area height minus image height)
         * @return {Object} { x: Number, y: Number }
         */
        coords: function( el, width, height ) {
            var vals = this.getValues(),
                pxX = vals[1].pixels( el, width ),
                pxY = vals[3].pixels( el, height );

            return {
                x: vals[0] === 'right' ? width - pxX : pxX,
                y: vals[2] === 'bottom' ? height - pxY : pxY
            };
        }
    };

    return BgPosition;
})();
/**
 * Wrapper for a CSS3 background-size value.
 * @constructor
 * @param {String|PIE.Length} w The width parameter
 * @param {String|PIE.Length} h The height parameter, if any
 */
PIE.BgSize = (function() {

    var CONTAIN = 'contain',
        COVER = 'cover',
        AUTO = 'auto';


    function BgSize( w, h ) {
        this.w = w;
        this.h = h;
    }
    BgSize.prototype = {

        pixels: function( el, areaW, areaH, imgW, imgH ) {
            var me = this,
                w = me.w,
                h = me.h,
                areaRatio = areaW / areaH,
                imgRatio = imgW / imgH;

            if ( w === CONTAIN ) {
                w = imgRatio > areaRatio ? areaW : areaH * imgRatio;
                h = imgRatio > areaRatio ? areaW / imgRatio : areaH;
            }
            else if ( w === COVER ) {
                w = imgRatio < areaRatio ? areaW : areaH * imgRatio;
                h = imgRatio < areaRatio ? areaW / imgRatio : areaH;
            }
            else if ( w === AUTO ) {
                h = ( h === AUTO ? imgH : h.pixels( el, areaH ) );
                w = h * imgRatio;
            }
            else {
                w = w.pixels( el, areaW );
                h = ( h === AUTO ? w / imgRatio : h.pixels( el, areaH ) );
            }

            return { w: w, h: h };
        }

    };

    BgSize.DEFAULT = new BgSize( AUTO, AUTO );

    return BgSize;
})();
/**
 * Wrapper for angle values; handles conversion to degrees from all allowed angle units
 * @constructor
 * @param {string} val The raw CSS value for the angle. It is assumed it has been pre-validated.
 */
PIE.Angle = (function() {
    function Angle( val ) {
        this.val = val;
    }
    Angle.prototype = {
        unitRE: /[a-z]+$/i,

        /**
         * @return {string} The unit of the angle value
         */
        getUnit: function() {
            return this._unit || ( this._unit = this.val.match( this.unitRE )[0].toLowerCase() );
        },

        /**
         * Get the numeric value of the angle in degrees.
         * @return {number} The degrees value
         */
        degrees: function() {
            var deg = this._deg, u, n;
            if( deg === undefined ) {
                u = this.getUnit();
                n = parseFloat( this.val, 10 );
                deg = this._deg = ( u === 'deg' ? n : u === 'rad' ? n / Math.PI * 180 : u === 'grad' ? n / 400 * 360 : u === 'turn' ? n * 360 : 0 );
            }
            return deg;
        }
    };

    return Angle;
})();/**
 * Abstraction for colors values. Allows detection of rgba values. A singleton instance per unique
 * value is returned from PIE.getColor() - always use that instead of instantiating directly.
 * @constructor
 * @param {string} val The raw CSS string value for the color
 */
PIE.Color = (function() {
    var instances = {};

    function Color( val ) {
        this.val = val;
    }

    /**
     * Regular expression for matching rgba colors and extracting their components
     * @type {RegExp}
     */
    Color.rgbaRE = /\s*rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d+|\d*\.\d+)\s*\)\s*/;

    Color.names = {
        "aliceblue":"F0F8FF", "antiquewhite":"FAEBD7", "aqua":"0FF",
        "aquamarine":"7FFFD4", "azure":"F0FFFF", "beige":"F5F5DC",
        "bisque":"FFE4C4", "black":"000", "blanchedalmond":"FFEBCD",
        "blue":"00F", "blueviolet":"8A2BE2", "brown":"A52A2A",
        "burlywood":"DEB887", "cadetblue":"5F9EA0", "chartreuse":"7FFF00",
        "chocolate":"D2691E", "coral":"FF7F50", "cornflowerblue":"6495ED",
        "cornsilk":"FFF8DC", "crimson":"DC143C", "cyan":"0FF",
        "darkblue":"00008B", "darkcyan":"008B8B", "darkgoldenrod":"B8860B",
        "darkgray":"A9A9A9", "darkgreen":"006400", "darkkhaki":"BDB76B",
        "darkmagenta":"8B008B", "darkolivegreen":"556B2F", "darkorange":"FF8C00",
        "darkorchid":"9932CC", "darkred":"8B0000", "darksalmon":"E9967A",
        "darkseagreen":"8FBC8F", "darkslateblue":"483D8B", "darkslategray":"2F4F4F",
        "darkturquoise":"00CED1", "darkviolet":"9400D3", "deeppink":"FF1493",
        "deepskyblue":"00BFFF", "dimgray":"696969", "dodgerblue":"1E90FF",
        "firebrick":"B22222", "floralwhite":"FFFAF0", "forestgreen":"228B22",
        "fuchsia":"F0F", "gainsboro":"DCDCDC", "ghostwhite":"F8F8FF",
        "gold":"FFD700", "goldenrod":"DAA520", "gray":"808080",
        "green":"008000", "greenyellow":"ADFF2F", "honeydew":"F0FFF0",
        "hotpink":"FF69B4", "indianred":"CD5C5C", "indigo":"4B0082",
        "ivory":"FFFFF0", "khaki":"F0E68C", "lavender":"E6E6FA",
        "lavenderblush":"FFF0F5", "lawngreen":"7CFC00", "lemonchiffon":"FFFACD",
        "lightblue":"ADD8E6", "lightcoral":"F08080", "lightcyan":"E0FFFF",
        "lightgoldenrodyellow":"FAFAD2", "lightgreen":"90EE90", "lightgrey":"D3D3D3",
        "lightpink":"FFB6C1", "lightsalmon":"FFA07A", "lightseagreen":"20B2AA",
        "lightskyblue":"87CEFA", "lightslategray":"789", "lightsteelblue":"B0C4DE",
        "lightyellow":"FFFFE0", "lime":"0F0", "limegreen":"32CD32",
        "linen":"FAF0E6", "magenta":"F0F", "maroon":"800000",
        "mediumauqamarine":"66CDAA", "mediumblue":"0000CD", "mediumorchid":"BA55D3",
        "mediumpurple":"9370D8", "mediumseagreen":"3CB371", "mediumslateblue":"7B68EE",
        "mediumspringgreen":"00FA9A", "mediumturquoise":"48D1CC", "mediumvioletred":"C71585",
        "midnightblue":"191970", "mintcream":"F5FFFA", "mistyrose":"FFE4E1",
        "moccasin":"FFE4B5", "navajowhite":"FFDEAD", "navy":"000080",
        "oldlace":"FDF5E6", "olive":"808000", "olivedrab":"688E23",
        "orange":"FFA500", "orangered":"FF4500", "orchid":"DA70D6",
        "palegoldenrod":"EEE8AA", "palegreen":"98FB98", "paleturquoise":"AFEEEE",
        "palevioletred":"D87093", "papayawhip":"FFEFD5", "peachpuff":"FFDAB9",
        "peru":"CD853F", "pink":"FFC0CB", "plum":"DDA0DD",
        "powderblue":"B0E0E6", "purple":"800080", "red":"F00",
        "rosybrown":"BC8F8F", "royalblue":"4169E1", "saddlebrown":"8B4513",
        "salmon":"FA8072", "sandybrown":"F4A460", "seagreen":"2E8B57",
        "seashell":"FFF5EE", "sienna":"A0522D", "silver":"C0C0C0",
        "skyblue":"87CEEB", "slateblue":"6A5ACD", "slategray":"708090",
        "snow":"FFFAFA", "springgreen":"00FF7F", "steelblue":"4682B4",
        "tan":"D2B48C", "teal":"008080", "thistle":"D8BFD8",
        "tomato":"FF6347", "turquoise":"40E0D0", "violet":"EE82EE",
        "wheat":"F5DEB3", "white":"FFF", "whitesmoke":"F5F5F5",
        "yellow":"FF0", "yellowgreen":"9ACD32"
    };

    Color.prototype = {
        /**
         * @private
         */
        parse: function() {
            if( !this._color ) {
                var me = this,
                    v = me.val,
                    vLower,
                    m = v.match( Color.rgbaRE );
                if( m ) {
                    me._color = 'rgb(' + m[1] + ',' + m[2] + ',' + m[3] + ')';
                    me._alpha = parseFloat( m[4] );
                }
                else {
                    if( ( vLower = v.toLowerCase() ) in Color.names ) {
                        v = '#' + Color.names[vLower];
                    }
                    me._color = v;
                    me._alpha = ( v === 'transparent' ? 0 : 1 );
                }
            }
        },

        /**
         * Retrieve the value of the color in a format usable by IE natively. This will be the same as
         * the raw input value, except for rgba values which will be converted to an rgb value.
         * @param {Element} el The context element, used to get 'currentColor' keyword value.
         * @return {string} Color value
         */
        colorValue: function( el ) {
            this.parse();
            return this._color === 'currentColor' ? el.currentStyle.color : this._color;
        },

        /**
         * Retrieve the alpha value of the color. Will be 1 for all values except for rgba values
         * with an alpha component.
         * @return {number} The alpha value, from 0 to 1.
         */
        alpha: function() {
            this.parse();
            return this._alpha;
        }
    };


    /**
     * Retrieve a PIE.Color instance for the given value. A shared singleton instance is returned for each unique value.
     * @param {string} val The CSS string representing the color. It is assumed that this will already have
     *                 been validated as a valid color syntax.
     */
    PIE.getColor = function(val) {
        return instances[ val ] || ( instances[ val ] = new Color( val ) );
    };

    return Color;
})();/**
 * A tokenizer for CSS value strings.
 * @constructor
 * @param {string} css The CSS value string
 */
PIE.Tokenizer = (function() {
    function Tokenizer( css ) {
        this.css = css;
        this.ch = 0;
        this.tokens = [];
        this.tokenIndex = 0;
    }

    /**
     * Enumeration of token type constants.
     * @enum {number}
     */
    var Type = Tokenizer.Type = {
        ANGLE: 1,
        CHARACTER: 2,
        COLOR: 4,
        DIMEN: 8,
        FUNCTION: 16,
        IDENT: 32,
        LENGTH: 64,
        NUMBER: 128,
        OPERATOR: 256,
        PERCENT: 512,
        STRING: 1024,
        URL: 2048
    };

    /**
     * A single token
     * @constructor
     * @param {number} type The type of the token - see PIE.Tokenizer.Type
     * @param {string} value The value of the token
     */
    Tokenizer.Token = function( type, value ) {
        this.tokenType = type;
        this.tokenValue = value;
    };
    Tokenizer.Token.prototype = {
        isLength: function() {
            return this.tokenType & Type.LENGTH || ( this.tokenType & Type.NUMBER && this.tokenValue === '0' );
        },
        isLengthOrPercent: function() {
            return this.isLength() || this.tokenType & Type.PERCENT;
        }
    };

    Tokenizer.prototype = {
        whitespace: /\s/,
        number: /^[\+\-]?(\d*\.)?\d+/,
        url: /^url\(\s*("([^"]*)"|'([^']*)'|([!#$%&*-~]*))\s*\)/i,
        ident: /^\-?[_a-z][\w-]*/i,
        string: /^("([^"]*)"|'([^']*)')/,
        operator: /^[\/,]/,
        hash: /^#[\w]+/,
        hashColor: /^#([\da-f]{6}|[\da-f]{3})/i,

        unitTypes: {
            'px': Type.LENGTH, 'em': Type.LENGTH, 'ex': Type.LENGTH,
            'mm': Type.LENGTH, 'cm': Type.LENGTH, 'in': Type.LENGTH,
            'pt': Type.LENGTH, 'pc': Type.LENGTH,
            'deg': Type.ANGLE, 'rad': Type.ANGLE, 'grad': Type.ANGLE
        },

        colorFunctions: {
            'rgb': 1, 'rgba': 1, 'hsl': 1, 'hsla': 1
        },


        /**
         * Advance to and return the next token in the CSS string. If the end of the CSS string has
         * been reached, null will be returned.
         * @param {boolean} forget - if true, the token will not be stored for the purposes of backtracking with prev().
         * @return {PIE.Tokenizer.Token}
         */
        next: function( forget ) {
            var css, ch, firstChar, match, val,
                me = this;

            function newToken( type, value ) {
                var tok = new Tokenizer.Token( type, value );
                if( !forget ) {
                    me.tokens.push( tok );
                    me.tokenIndex++;
                }
                return tok;
            }
            function failure() {
                me.tokenIndex++;
                return null;
            }

            // In case we previously backed up, return the stored token in the next slot
            if( this.tokenIndex < this.tokens.length ) {
                return this.tokens[ this.tokenIndex++ ];
            }

            // Move past leading whitespace characters
            while( this.whitespace.test( this.css.charAt( this.ch ) ) ) {
                this.ch++;
            }
            if( this.ch >= this.css.length ) {
                return failure();
            }

            ch = this.ch;
            css = this.css.substring( this.ch );
            firstChar = css.charAt( 0 );
            switch( firstChar ) {
                case '#':
                    if( match = css.match( this.hashColor ) ) {
                        this.ch += match[0].length;
                        return newToken( Type.COLOR, match[0] );
                    }
                    break;

                case '"':
                case "'":
                    if( match = css.match( this.string ) ) {
                        this.ch += match[0].length;
                        return newToken( Type.STRING, match[2] || match[3] || '' );
                    }
                    break;

                case "/":
                case ",":
                    this.ch++;
                    return newToken( Type.OPERATOR, firstChar );

                case 'u':
                    if( match = css.match( this.url ) ) {
                        this.ch += match[0].length;
                        return newToken( Type.URL, match[2] || match[3] || match[4] || '' );
                    }
            }

            // Numbers and values starting with numbers
            if( match = css.match( this.number ) ) {
                val = match[0];
                this.ch += val.length;

                // Check if it is followed by a unit
                if( css.charAt( val.length ) === '%' ) {
                    this.ch++;
                    return newToken( Type.PERCENT, val + '%' );
                }
                if( match = css.substring( val.length ).match( this.ident ) ) {
                    val += match[0];
                    this.ch += match[0].length;
                    return newToken( this.unitTypes[ match[0].toLowerCase() ] || Type.DIMEN, val );
                }

                // Plain ol' number
                return newToken( Type.NUMBER, val );
            }

            // Identifiers
            if( match = css.match( this.ident ) ) {
                val = match[0];
                this.ch += val.length;

                // Named colors
                if( val.toLowerCase() in PIE.Color.names || val === 'currentColor' || val === 'transparent' ) {
                    return newToken( Type.COLOR, val );
                }

                // Functions
                if( css.charAt( val.length ) === '(' ) {
                    this.ch++;

                    // Color values in function format: rgb, rgba, hsl, hsla
                    if( val.toLowerCase() in this.colorFunctions ) {
                        function isNum( tok ) {
                            return tok && tok.tokenType & Type.NUMBER;
                        }
                        function isNumOrPct( tok ) {
                            return tok && ( tok.tokenType & ( Type.NUMBER | Type.PERCENT ) );
                        }
                        function isValue( tok, val ) {
                            return tok && tok.tokenValue === val;
                        }
                        function next() {
                            return me.next( 1 );
                        }

                        if( ( val.charAt(0) === 'r' ? isNumOrPct( next() ) : isNum( next() ) ) &&
                            isValue( next(), ',' ) &&
                            isNumOrPct( next() ) &&
                            isValue( next(), ',' ) &&
                            isNumOrPct( next() ) &&
                            ( val === 'rgb' || val === 'hsa' || (
                                isValue( next(), ',' ) &&
                                isNum( next() )
                            ) ) &&
                            isValue( next(), ')' ) ) {
                            return newToken( Type.COLOR, this.css.substring( ch, this.ch ) );
                        }
                        return failure();
                    }

                    return newToken( Type.FUNCTION, val );
                }

                // Other identifier
                return newToken( Type.IDENT, val );
            }

            // Standalone character
            this.ch++;
            return newToken( Type.CHARACTER, firstChar );
        },

        /**
         * Determine whether there is another token
         * @return {boolean}
         */
        hasNext: function() {
            var next = this.next();
            this.prev();
            return !!next;
        },

        /**
         * Back up and return the previous token
         * @return {PIE.Tokenizer.Token}
         */
        prev: function() {
            return this.tokens[ this.tokenIndex-- - 2 ];
        },

        /**
         * Retrieve all the tokens in the CSS string
         * @return {Array.<PIE.Tokenizer.Token>}
         */
        all: function() {
            while( this.next() ) {}
            return this.tokens;
        },

        /**
         * Return a list of tokens from the current position until the given function returns
         * true. The final token will not be included in the list.
         * @param {function():boolean} func - test function
         * @param {boolean} require - if true, then if the end of the CSS string is reached
         *        before the test function returns true, null will be returned instead of the
         *        tokens that have been found so far.
         * @return {Array.<PIE.Tokenizer.Token>}
         */
        until: function( func, require ) {
            var list = [], t, hit;
            while( t = this.next() ) {
                if( func( t ) ) {
                    hit = true;
                    this.prev();
                    break;
                }
                list.push( t );
            }
            return require && !hit ? null : list;
        }
    };

    return Tokenizer;
})();/**
 * Handles calculating, caching, and detecting changes to size and position of the element.
 * @constructor
 * @param {Element} el the target element
 */
PIE.BoundsInfo = function( el ) {
    this.targetElement = el;
};
PIE.BoundsInfo.prototype = {

    _locked: 0,

    positionChanged: function() {
        var last = this._lastBounds,
            bounds;
        return !last || ( ( bounds = this.getBounds() ) && ( last.x !== bounds.x || last.y !== bounds.y ) );
    },

    sizeChanged: function() {
        var last = this._lastBounds,
            bounds;
        return !last || ( ( bounds = this.getBounds() ) && ( last.w !== bounds.w || last.h !== bounds.h ) );
    },

    getLiveBounds: function() {
        var el = this.targetElement,
            rect = el.getBoundingClientRect(),
            isIE9 = PIE.ieDocMode === 9,
            isIE7 = PIE.ieVersion === 7,
            width = rect.right - rect.left;
        return {
            x: rect.left,
            y: rect.top,
            // In some cases scrolling the page will cause IE9 to report incorrect dimensions
            // in the rect returned by getBoundingClientRect, so we must query offsetWidth/Height
            // instead. Also IE7 is inconsistent in using logical vs. device pixels in measurements
            // so we must calculate the ratio and use it in certain places as a position adjustment.
            w: isIE9 || isIE7 ? el.offsetWidth : width,
            h: isIE9 || isIE7 ? el.offsetHeight : rect.bottom - rect.top,
            logicalZoomRatio: ( isIE7 && width ) ? el.offsetWidth / width : 1
        };
    },

    getBounds: function() {
        return this._locked ? 
                ( this._lockedBounds || ( this._lockedBounds = this.getLiveBounds() ) ) :
                this.getLiveBounds();
    },

    hasBeenQueried: function() {
        return !!this._lastBounds;
    },

    lock: function() {
        ++this._locked;
    },

    unlock: function() {
        if( !--this._locked ) {
            if( this._lockedBounds ) this._lastBounds = this._lockedBounds;
            this._lockedBounds = null;
        }
    }

};
(function() {

function cacheWhenLocked( fn ) {
    var uid = PIE.Util.getUID( fn );
    return function() {
        if( this._locked ) {
            var cache = this._lockedValues || ( this._lockedValues = {} );
            return ( uid in cache ) ? cache[ uid ] : ( cache[ uid ] = fn.call( this ) );
        } else {
            return fn.call( this );
        }
    }
}


PIE.StyleInfoBase = {

    _locked: 0,

    /**
     * Create a new StyleInfo class, with the standard constructor, and augmented by
     * the StyleInfoBase's members.
     * @param proto
     */
    newStyleInfo: function( proto ) {
        function StyleInfo( el ) {
            this.targetElement = el;
            this._lastCss = this.getCss();
        }
        PIE.Util.merge( StyleInfo.prototype, PIE.StyleInfoBase, proto );
        StyleInfo._propsCache = {};
        return StyleInfo;
    },

    /**
     * Get an object representation of the target CSS style, caching it for each unique
     * CSS value string.
     * @return {Object}
     */
    getProps: function() {
        var css = this.getCss(),
            cache = this.constructor._propsCache;
        return css ? ( css in cache ? cache[ css ] : ( cache[ css ] = this.parseCss( css ) ) ) : null;
    },

    /**
     * Get the raw CSS value for the target style
     * @return {string}
     */
    getCss: cacheWhenLocked( function() {
        var el = this.targetElement,
            ctor = this.constructor,
            s = el.style,
            cs = el.currentStyle,
            cssProp = this.cssProperty,
            styleProp = this.styleProperty,
            prefixedCssProp = ctor._prefixedCssProp || ( ctor._prefixedCssProp = PIE.CSS_PREFIX + cssProp ),
            prefixedStyleProp = ctor._prefixedStyleProp || ( ctor._prefixedStyleProp = PIE.STYLE_PREFIX + styleProp.charAt(0).toUpperCase() + styleProp.substring(1) );
        return s[ prefixedStyleProp ] || cs.getAttribute( prefixedCssProp ) || s[ styleProp ] || cs.getAttribute( cssProp );
    } ),

    /**
     * Determine whether the target CSS style is active.
     * @return {boolean}
     */
    isActive: cacheWhenLocked( function() {
        return !!this.getProps();
    } ),

    /**
     * Determine whether the target CSS style has changed since the last time it was used.
     * @return {boolean}
     */
    changed: cacheWhenLocked( function() {
        var currentCss = this.getCss(),
            changed = currentCss !== this._lastCss;
        this._lastCss = currentCss;
        return changed;
    } ),

    cacheWhenLocked: cacheWhenLocked,

    lock: function() {
        ++this._locked;
    },

    unlock: function() {
        if( !--this._locked ) {
            delete this._lockedValues;
        }
    }
};

})();/**
 * Handles parsing, caching, and detecting changes to background (and -pie-background) CSS
 * @constructor
 * @param {Element} el the target element
 */
PIE.BackgroundStyleInfo = PIE.StyleInfoBase.newStyleInfo( {

    cssProperty: PIE.CSS_PREFIX + 'background',
    styleProperty: PIE.STYLE_PREFIX + 'Background',

    attachIdents: { 'scroll':1, 'fixed':1, 'local':1 },
    repeatIdents: { 'repeat-x':1, 'repeat-y':1, 'repeat':1, 'no-repeat':1 },
    originAndClipIdents: { 'padding-box':1, 'border-box':1, 'content-box':1 },
    positionIdents: { 'top':1, 'right':1, 'bottom':1, 'left':1, 'center':1 },
    sizeIdents: { 'contain':1, 'cover':1 },
    propertyNames: {
        CLIP: 'backgroundClip',
        COLOR: 'backgroundColor',
        IMAGE: 'backgroundImage',
        ORIGIN: 'backgroundOrigin',
        POSITION: 'backgroundPosition',
        REPEAT: 'backgroundRepeat',
        SIZE: 'backgroundSize'
    },

    /**
     * For background styles, we support the -pie-background property but fall back to the standard
     * backround* properties.  The reason we have to use the prefixed version is that IE natively
     * parses the standard properties and if it sees something it doesn't know how to parse, for example
     * multiple values or gradient definitions, it will throw that away and not make it available through
     * currentStyle.
     *
     * Format of return object:
     * {
     *     color: <PIE.Color>,
     *     bgImages: [
     *         {
     *             imgType: 'image',
     *             imgUrl: 'image.png',
     *             imgRepeat: <'no-repeat' | 'repeat-x' | 'repeat-y' | 'repeat'>,
     *             bgPosition: <PIE.BgPosition>,
     *             bgAttachment: <'scroll' | 'fixed' | 'local'>,
     *             bgOrigin: <'border-box' | 'padding-box' | 'content-box'>,
     *             bgClip: <'border-box' | 'padding-box'>,
     *             bgSize: <PIE.BgSize>,
     *             origString: 'url(img.png) no-repeat top left'
     *         },
     *         {
     *             imgType: 'linear-gradient',
     *             gradientStart: <PIE.BgPosition>,
     *             angle: <PIE.Angle>,
     *             stops: [
     *                 { color: <PIE.Color>, offset: <PIE.Length> },
     *                 { color: <PIE.Color>, offset: <PIE.Length> }, ...
     *             ]
     *         }
     *     ]
     * }
     * @param {String} css
     * @override
     */
    parseCss: function( css ) {
        var el = this.targetElement,
            cs = el.currentStyle,
            tokenizer, token, image,
            tok_type = PIE.Tokenizer.Type,
            type_operator = tok_type.OPERATOR,
            type_ident = tok_type.IDENT,
            type_color = tok_type.COLOR,
            tokType, tokVal,
            beginCharIndex = 0,
            positionIdents = this.positionIdents,
            gradient, stop, width, height,
            props = { bgImages: [] };

        function isBgPosToken( token ) {
            return token && token.isLengthOrPercent() || ( token.tokenType & type_ident && token.tokenValue in positionIdents );
        }

        function sizeToken( token ) {
            return token && ( ( token.isLengthOrPercent() && PIE.getLength( token.tokenValue ) ) || ( token.tokenValue === 'auto' && 'auto' ) );
        }

        // If the CSS3-specific -pie-background property is present, parse it
        if( this.getCss3() ) {
            tokenizer = new PIE.Tokenizer( css );
            image = {};

            while( token = tokenizer.next() ) {
                tokType = token.tokenType;
                tokVal = token.tokenValue;

                if( !image.imgType && tokType & tok_type.FUNCTION && tokVal === 'linear-gradient' ) {
                    gradient = { stops: [], imgType: tokVal };
                    stop = {};
                    while( token = tokenizer.next() ) {
                        tokType = token.tokenType;
                        tokVal = token.tokenValue;

                        // If we reached the end of the function and had at least 2 stops, flush the info
                        if( tokType & tok_type.CHARACTER && tokVal === ')' ) {
                            if( stop.color ) {
                                gradient.stops.push( stop );
                            }
                            if( gradient.stops.length > 1 ) {
                                PIE.Util.merge( image, gradient );
                            }
                            break;
                        }

                        // Color stop - must start with color
                        if( tokType & type_color ) {
                            // if we already have an angle/position, make sure that the previous token was a comma
                            if( gradient.angle || gradient.gradientStart ) {
                                token = tokenizer.prev();
                                if( token.tokenType !== type_operator ) {
                                    break; //fail
                                }
                                tokenizer.next();
                            }

                            stop = {
                                color: PIE.getColor( tokVal )
                            };
                            // check for offset following color
                            token = tokenizer.next();
                            if( token.isLengthOrPercent() ) {
                                stop.offset = PIE.getLength( token.tokenValue );
                            } else {
                                tokenizer.prev();
                            }
                        }
                        // Angle - can only appear in first spot
                        else if( tokType & tok_type.ANGLE && !gradient.angle && !stop.color && !gradient.stops.length ) {
                            gradient.angle = new PIE.Angle( token.tokenValue );
                        }
                        else if( isBgPosToken( token ) && !gradient.gradientStart && !stop.color && !gradient.stops.length ) {
                            tokenizer.prev();
                            gradient.gradientStart = new PIE.BgPosition(
                                tokenizer.until( function( t ) {
                                    return !isBgPosToken( t );
                                }, false )
                            );
                        }
                        else if( tokType & type_operator && tokVal === ',' ) {
                            if( stop.color ) {
                                gradient.stops.push( stop );
                                stop = {};
                            }
                        }
                        else {
                            // Found something we didn't recognize; fail without adding image
                            break;
                        }
                    }
                }
                else if( !image.imgType && tokType & tok_type.URL ) {
                    image.imgUrl = tokVal;
                    image.imgType = 'image';
                }
                else if( isBgPosToken( token ) && !image.bgPosition ) {
                    tokenizer.prev();
                    image.bgPosition = new PIE.BgPosition(
                        tokenizer.until( function( t ) {
                            return !isBgPosToken( t );
                        }, false )
                    );
                }
                else if( tokType & type_ident ) {
                    if( tokVal in this.repeatIdents && !image.imgRepeat ) {
                        image.imgRepeat = tokVal;
                    }
                    else if( tokVal in this.originAndClipIdents && !image.bgOrigin ) {
                        image.bgOrigin = tokVal;
                        if( ( token = tokenizer.next() ) && ( token.tokenType & type_ident ) &&
                            token.tokenValue in this.originAndClipIdents ) {
                            image.bgClip = token.tokenValue;
                        } else {
                            image.bgClip = tokVal;
                            tokenizer.prev();
                        }
                    }
                    else if( tokVal in this.attachIdents && !image.bgAttachment ) {
                        image.bgAttachment = tokVal;
                    }
                    else {
                        return null;
                    }
                }
                else if( tokType & type_color && !props.color ) {
                    props.color = PIE.getColor( tokVal );
                }
                else if( tokType & type_operator && tokVal === '/' && !image.bgSize && image.bgPosition ) {
                    // background size
                    token = tokenizer.next();
                    if( token.tokenType & type_ident && token.tokenValue in this.sizeIdents ) {
                        image.bgSize = new PIE.BgSize( token.tokenValue );
                    }
                    else if( width = sizeToken( token ) ) {
                        height = sizeToken( tokenizer.next() );
                        if ( !height ) {
                            height = width;
                            tokenizer.prev();
                        }
                        image.bgSize = new PIE.BgSize( width, height );
                    }
                    else {
                        return null;
                    }
                }
                // new layer
                else if( tokType & type_operator && tokVal === ',' && image.imgType ) {
                    image.origString = css.substring( beginCharIndex, tokenizer.ch - 1 );
                    beginCharIndex = tokenizer.ch;
                    props.bgImages.push( image );
                    image = {};
                }
                else {
                    // Found something unrecognized; chuck everything
                    return null;
                }
            }

            // leftovers
            if( image.imgType ) {
                image.origString = css.substring( beginCharIndex );
                props.bgImages.push( image );
            }
        }

        // Otherwise, use the standard background properties; let IE give us the values rather than parsing them
        else {
            this.withActualBg( PIE.ieDocMode < 9 ?
                function() {
                    var propNames = this.propertyNames,
                        posX = cs[propNames.POSITION + 'X'],
                        posY = cs[propNames.POSITION + 'Y'],
                        img = cs[propNames.IMAGE],
                        color = cs[propNames.COLOR];

                    if( color !== 'transparent' ) {
                        props.color = PIE.getColor( color )
                    }
                    if( img !== 'none' ) {
                        props.bgImages = [ {
                            imgType: 'image',
                            imgUrl: new PIE.Tokenizer( img ).next().tokenValue,
                            imgRepeat: cs[propNames.REPEAT],
                            bgPosition: new PIE.BgPosition( new PIE.Tokenizer( posX + ' ' + posY ).all() )
                        } ];
                    }
                } :
                function() {
                    var propNames = this.propertyNames,
                        splitter = /\s*,\s*/,
                        images = cs[propNames.IMAGE].split( splitter ),
                        color = cs[propNames.COLOR],
                        repeats, positions, origins, clips, sizes, i, len, image, sizeParts;

                    if( color !== 'transparent' ) {
                        props.color = PIE.getColor( color )
                    }

                    len = images.length;
                    if( len && images[0] !== 'none' ) {
                        repeats = cs[propNames.REPEAT].split( splitter );
                        positions = cs[propNames.POSITION].split( splitter );
                        origins = cs[propNames.ORIGIN].split( splitter );
                        clips = cs[propNames.CLIP].split( splitter );
                        sizes = cs[propNames.SIZE].split( splitter );

                        props.bgImages = [];
                        for( i = 0; i < len; i++ ) {
                            image = images[ i ];
                            if( image && image !== 'none' ) {
                                sizeParts = sizes[i].split( ' ' );
                                props.bgImages.push( {
                                    origString: image + ' ' + repeats[ i ] + ' ' + positions[ i ] + ' / ' + sizes[ i ] + ' ' +
                                                origins[ i ] + ' ' + clips[ i ],
                                    imgType: 'image',
                                    imgUrl: new PIE.Tokenizer( image ).next().tokenValue,
                                    imgRepeat: repeats[ i ],
                                    bgPosition: new PIE.BgPosition( new PIE.Tokenizer( positions[ i ] ).all() ),
                                    bgOrigin: origins[ i ],
                                    bgClip: clips[ i ],
                                    bgSize: new PIE.BgSize( sizeParts[ 0 ], sizeParts[ 1 ] )
                                } );
                            }
                        }
                    }
                }
            );
        }

        return ( props.color || props.bgImages[0] ) ? props : null;
    },

    /**
     * Execute a function with the actual background styles (not overridden with runtimeStyle
     * properties set by the renderers) available via currentStyle.
     * @param fn
     */
    withActualBg: function( fn ) {
        var isIE9 = PIE.ieDocMode > 8,
            propNames = this.propertyNames,
            rs = this.targetElement.runtimeStyle,
            rsImage = rs[propNames.IMAGE],
            rsColor = rs[propNames.COLOR],
            rsRepeat = rs[propNames.REPEAT],
            rsClip, rsOrigin, rsSize, rsPosition, ret;

        if( rsImage ) rs[propNames.IMAGE] = '';
        if( rsColor ) rs[propNames.COLOR] = '';
        if( rsRepeat ) rs[propNames.REPEAT] = '';
        if( isIE9 ) {
            rsClip = rs[propNames.CLIP];
            rsOrigin = rs[propNames.ORIGIN];
            rsPosition = rs[propNames.POSITION];
            rsSize = rs[propNames.SIZE];
            if( rsClip ) rs[propNames.CLIP] = '';
            if( rsOrigin ) rs[propNames.ORIGIN] = '';
            if( rsPosition ) rs[propNames.POSITION] = '';
            if( rsSize ) rs[propNames.SIZE] = '';
        }

        ret = fn.call( this );

        if( rsImage ) rs[propNames.IMAGE] = rsImage;
        if( rsColor ) rs[propNames.COLOR] = rsColor;
        if( rsRepeat ) rs[propNames.REPEAT] = rsRepeat;
        if( isIE9 ) {
            if( rsClip ) rs[propNames.CLIP] = rsClip;
            if( rsOrigin ) rs[propNames.ORIGIN] = rsOrigin;
            if( rsPosition ) rs[propNames.POSITION] = rsPosition;
            if( rsSize ) rs[propNames.SIZE] = rsSize;
        }

        return ret;
    },

    getCss: PIE.StyleInfoBase.cacheWhenLocked( function() {
        return this.getCss3() ||
               this.withActualBg( function() {
                   var cs = this.targetElement.currentStyle,
                       propNames = this.propertyNames;
                   return cs[propNames.COLOR] + ' ' + cs[propNames.IMAGE] + ' ' + cs[propNames.REPEAT] + ' ' +
                   cs[propNames.POSITION + 'X'] + ' ' + cs[propNames.POSITION + 'Y'];
               } );
    } ),

    getCss3: PIE.StyleInfoBase.cacheWhenLocked( function() {
        var el = this.targetElement;
        return el.style[ this.styleProperty ] || el.currentStyle.getAttribute( this.cssProperty );
    } ),

    /**
     * Tests if style.PiePngFix or the -pie-png-fix property is set to true in IE6.
     */
    isPngFix: function() {
        var val = 0, el;
        if( PIE.ieVersion < 7 ) {
            el = this.targetElement;
            val = ( '' + ( el.style[ PIE.STYLE_PREFIX + 'PngFix' ] || el.currentStyle.getAttribute( PIE.CSS_PREFIX + 'png-fix' ) ) === 'true' );
        }
        return val;
    },
    
    /**
     * The isActive logic is slightly different, because getProps() always returns an object
     * even if it is just falling back to the native background properties.  But we only want
     * to report is as being "active" if either the -pie-background override property is present
     * and parses successfully or '-pie-png-fix' is set to true in IE6.
     */
    isActive: PIE.StyleInfoBase.cacheWhenLocked( function() {
        return (this.getCss3() || this.isPngFix()) && !!this.getProps();
    } )

} );/**
 * Handles parsing, caching, and detecting changes to border CSS
 * @constructor
 * @param {Element} el the target element
 */
PIE.BorderStyleInfo = PIE.StyleInfoBase.newStyleInfo( {

    sides: [ 'Top', 'Right', 'Bottom', 'Left' ],
    namedWidths: {
        'thin': '1px',
        'medium': '3px',
        'thick': '5px'
    },

    parseCss: function( css ) {
        var w = {},
            s = {},
            c = {},
            active = false,
            colorsSame = true,
            stylesSame = true,
            widthsSame = true;

        this.withActualBorder( function() {
            var el = this.targetElement,
                cs = el.currentStyle,
                i = 0,
                style, color, width, lastStyle, lastColor, lastWidth, side, ltr;
            for( ; i < 4; i++ ) {
                side = this.sides[ i ];

                ltr = side.charAt(0).toLowerCase();
                style = s[ ltr ] = cs[ 'border' + side + 'Style' ];
                color = cs[ 'border' + side + 'Color' ];
                width = cs[ 'border' + side + 'Width' ];

                if( i > 0 ) {
                    if( style !== lastStyle ) { stylesSame = false; }
                    if( color !== lastColor ) { colorsSame = false; }
                    if( width !== lastWidth ) { widthsSame = false; }
                }
                lastStyle = style;
                lastColor = color;
                lastWidth = width;

                c[ ltr ] = PIE.getColor( color );

                width = w[ ltr ] = PIE.getLength( s[ ltr ] === 'none' ? '0' : ( this.namedWidths[ width ] || width ) );
                if( width.pixels( this.targetElement ) > 0 ) {
                    active = true;
                }
            }
        } );

        return active ? {
            widths: w,
            styles: s,
            colors: c,
            widthsSame: widthsSame,
            colorsSame: colorsSame,
            stylesSame: stylesSame
        } : null;
    },

    getCss: PIE.StyleInfoBase.cacheWhenLocked( function() {
        var el = this.targetElement,
            cs = el.currentStyle,
            css;

        // Don't redraw or hide borders for cells in border-collapse:collapse tables
        if( !( el.tagName in PIE.tableCellTags && el.offsetParent.currentStyle.borderCollapse === 'collapse' ) ) {
            this.withActualBorder( function() {
                css = cs.borderWidth + '|' + cs.borderStyle + '|' + cs.borderColor;
            } );
        }
        return css;
    } ),

    /**
     * Execute a function with the actual border styles (not overridden with runtimeStyle
     * properties set by the renderers) available via currentStyle.
     * @param fn
     */
    withActualBorder: function( fn ) {
        var rs = this.targetElement.runtimeStyle,
            rsWidth = rs.borderWidth,
            rsColor = rs.borderColor,
            ret;

        if( rsWidth ) rs.borderWidth = '';
        if( rsColor ) rs.borderColor = '';

        ret = fn.call( this );

        if( rsWidth ) rs.borderWidth = rsWidth;
        if( rsColor ) rs.borderColor = rsColor;

        return ret;
    }

} );
/**
 * Handles parsing, caching, and detecting changes to border-radius CSS
 * @constructor
 * @param {Element} el the target element
 */
(function() {

PIE.BorderRadiusStyleInfo = PIE.StyleInfoBase.newStyleInfo( {

    cssProperty: 'border-radius',
    styleProperty: 'borderRadius',

    parseCss: function( css ) {
        var p = null, x, y,
            tokenizer, token, length,
            hasNonZero = false;

        if( css ) {
            tokenizer = new PIE.Tokenizer( css );

            function collectLengths() {
                var arr = [], num;
                while( ( token = tokenizer.next() ) && token.isLengthOrPercent() ) {
                    length = PIE.getLength( token.tokenValue );
                    num = length.getNumber();
                    if( num < 0 ) {
                        return null;
                    }
                    if( num > 0 ) {
                        hasNonZero = true;
                    }
                    arr.push( length );
                }
                return arr.length > 0 && arr.length < 5 ? {
                        'tl': arr[0],
                        'tr': arr[1] || arr[0],
                        'br': arr[2] || arr[0],
                        'bl': arr[3] || arr[1] || arr[0]
                    } : null;
            }

            // Grab the initial sequence of lengths
            if( x = collectLengths() ) {
                // See if there is a slash followed by more lengths, for the y-axis radii
                if( token ) {
                    if( token.tokenType & PIE.Tokenizer.Type.OPERATOR && token.tokenValue === '/' ) {
                        y = collectLengths();
                    }
                } else {
                    y = x;
                }

                // Treat all-zero values the same as no value
                if( hasNonZero && x && y ) {
                    p = { x: x, y : y };
                }
            }
        }

        return p;
    }
} );

var zero = PIE.getLength( '0' ),
    zeros = { 'tl': zero, 'tr': zero, 'br': zero, 'bl': zero };
PIE.BorderRadiusStyleInfo.ALL_ZERO = { x: zeros, y: zeros };

})();/**
 * Handles parsing, caching, and detecting changes to border-image CSS
 * @constructor
 * @param {Element} el the target element
 */
PIE.BorderImageStyleInfo = PIE.StyleInfoBase.newStyleInfo( {

    cssProperty: 'border-image',
    styleProperty: 'borderImage',

    repeatIdents: { 'stretch':1, 'round':1, 'repeat':1, 'space':1 },

    parseCss: function( css ) {
        var p = null, tokenizer, token, type, value,
            slices, widths, outsets,
            slashCount = 0,
            Type = PIE.Tokenizer.Type,
            IDENT = Type.IDENT,
            NUMBER = Type.NUMBER,
            PERCENT = Type.PERCENT;

        if( css ) {
            tokenizer = new PIE.Tokenizer( css );
            p = {};

            function isSlash( token ) {
                return token && ( token.tokenType & Type.OPERATOR ) && ( token.tokenValue === '/' );
            }

            function isFillIdent( token ) {
                return token && ( token.tokenType & IDENT ) && ( token.tokenValue === 'fill' );
            }

            function collectSlicesEtc() {
                slices = tokenizer.until( function( tok ) {
                    return !( tok.tokenType & ( NUMBER | PERCENT ) );
                } );

                if( isFillIdent( tokenizer.next() ) && !p.fill ) {
                    p.fill = true;
                } else {
                    tokenizer.prev();
                }

                if( isSlash( tokenizer.next() ) ) {
                    slashCount++;
                    widths = tokenizer.until( function( token ) {
                        return !token.isLengthOrPercent() && !( ( token.tokenType & IDENT ) && token.tokenValue === 'auto' );
                    } );

                    if( isSlash( tokenizer.next() ) ) {
                        slashCount++;
                        outsets = tokenizer.until( function( token ) {
                            return !token.isLength();
                        } );
                    }
                } else {
                    tokenizer.prev();
                }
            }

            while( token = tokenizer.next() ) {
                type = token.tokenType;
                value = token.tokenValue;

                // Numbers and/or 'fill' keyword: slice values. May be followed optionally by width values, followed optionally by outset values
                if( type & ( NUMBER | PERCENT ) && !slices ) {
                    tokenizer.prev();
                    collectSlicesEtc();
                }
                else if( isFillIdent( token ) && !p.fill ) {
                    p.fill = true;
                    collectSlicesEtc();
                }

                // Idents: one or values for 'repeat'
                else if( ( type & IDENT ) && this.repeatIdents[value] && !p.repeat ) {
                    p.repeat = { h: value };
                    if( token = tokenizer.next() ) {
                        if( ( token.tokenType & IDENT ) && this.repeatIdents[token.tokenValue] ) {
                            p.repeat.v = token.tokenValue;
                        } else {
                            tokenizer.prev();
                        }
                    }
                }

                // URL of the image
                else if( ( type & Type.URL ) && !p.src ) {
                    p.src =  value;
                }

                // Found something unrecognized; exit.
                else {
                    return null;
                }
            }

            // Validate what we collected
            if( !p.src || !slices || slices.length < 1 || slices.length > 4 ||
                ( widths && widths.length > 4 ) || ( slashCount === 1 && widths.length < 1 ) ||
                ( outsets && outsets.length > 4 ) || ( slashCount === 2 && outsets.length < 1 ) ) {
                return null;
            }

            // Fill in missing values
            if( !p.repeat ) {
                p.repeat = { h: 'stretch' };
            }
            if( !p.repeat.v ) {
                p.repeat.v = p.repeat.h;
            }

            function distributeSides( tokens, convertFn ) {
                return {
                    't': convertFn( tokens[0] ),
                    'r': convertFn( tokens[1] || tokens[0] ),
                    'b': convertFn( tokens[2] || tokens[0] ),
                    'l': convertFn( tokens[3] || tokens[1] || tokens[0] )
                };
            }

            p.slice = distributeSides( slices, function( tok ) {
                return PIE.getLength( ( tok.tokenType & NUMBER ) ? tok.tokenValue + 'px' : tok.tokenValue );
            } );

            if( widths && widths[0] ) {
                p.widths = distributeSides( widths, function( tok ) {
                    return tok.isLengthOrPercent() ? PIE.getLength( tok.tokenValue ) : tok.tokenValue;
                } );
            }

            if( outsets && outsets[0] ) {
                p.outset = distributeSides( outsets, function( tok ) {
                    return tok.isLength() ? PIE.getLength( tok.tokenValue ) : tok.tokenValue;
                } );
            }
        }

        return p;
    }

} );/**
 * Handles parsing, caching, and detecting changes to box-shadow CSS
 * @constructor
 * @param {Element} el the target element
 */
PIE.BoxShadowStyleInfo = PIE.StyleInfoBase.newStyleInfo( {

    cssProperty: 'box-shadow',
    styleProperty: 'boxShadow',

    parseCss: function( css ) {
        var props,
            getLength = PIE.getLength,
            Type = PIE.Tokenizer.Type,
            tokenizer;

        if( css ) {
            tokenizer = new PIE.Tokenizer( css );
            props = { outset: [], inset: [] };

            function parseItem() {
                var token, type, value, color, lengths, inset, len;

                while( token = tokenizer.next() ) {
                    value = token.tokenValue;
                    type = token.tokenType;

                    if( type & Type.OPERATOR && value === ',' ) {
                        break;
                    }
                    else if( token.isLength() && !lengths ) {
                        tokenizer.prev();
                        lengths = tokenizer.until( function( token ) {
                            return !token.isLength();
                        } );
                    }
                    else if( type & Type.COLOR && !color ) {
                        color = value;
                    }
                    else if( type & Type.IDENT && value === 'inset' && !inset ) {
                        inset = true;
                    }
                    else { //encountered an unrecognized token; fail.
                        return false;
                    }
                }

                len = lengths && lengths.length;
                if( len > 1 && len < 5 ) {
                    ( inset ? props.inset : props.outset ).push( {
                        xOffset: getLength( lengths[0].tokenValue ),
                        yOffset: getLength( lengths[1].tokenValue ),
                        blur: getLength( lengths[2] ? lengths[2].tokenValue : '0' ),
                        spread: getLength( lengths[3] ? lengths[3].tokenValue : '0' ),
                        color: PIE.getColor( color || 'currentColor' )
                    } );
                    return true;
                }
                return false;
            }

            while( parseItem() ) {}
        }

        return props && ( props.inset.length || props.outset.length ) ? props : null;
    }
} );
/**
 * Retrieves the state of the element's visibility and display
 * @constructor
 * @param {Element} el the target element
 */
PIE.VisibilityStyleInfo = PIE.StyleInfoBase.newStyleInfo( {

    getCss: PIE.StyleInfoBase.cacheWhenLocked( function() {
        var cs = this.targetElement.currentStyle;
        return cs.visibility + '|' + cs.display;
    } ),

    parseCss: function() {
        var el = this.targetElement,
            rs = el.runtimeStyle,
            cs = el.currentStyle,
            rsVis = rs.visibility,
            csVis;

        rs.visibility = '';
        csVis = cs.visibility;
        rs.visibility = rsVis;

        return {
            visible: csVis !== 'hidden',
            displayed: cs.display !== 'none'
        }
    },

    /**
     * Always return false for isActive, since this property alone will not trigger
     * a renderer to do anything.
     */
    isActive: function() {
        return false;
    }

} );
PIE.RendererBase = {

    /**
     * Create a new Renderer class, with the standard constructor, and augmented by
     * the RendererBase's members.
     * @param proto
     */
    newRenderer: function( proto ) {
        function Renderer( el, boundsInfo, styleInfos, parent ) {
            this.targetElement = el;
            this.boundsInfo = boundsInfo;
            this.styleInfos = styleInfos;
            this.parent = parent;
        }
        PIE.Util.merge( Renderer.prototype, PIE.RendererBase, proto );
        return Renderer;
    },

    /**
     * Flag indicating the element has already been positioned at least once.
     * @type {boolean}
     */
    isPositioned: false,

    /**
     * Determine if the renderer needs to be updated
     * @return {boolean}
     */
    needsUpdate: function() {
        return false;
    },

    /**
     * Run any preparation logic that would affect the main update logic of this
     * renderer or any of the other renderers, e.g. things that might affect the
     * element's size or style properties.
     */
    prepareUpdate: PIE.emptyFn,

    /**
     * Tell the renderer to update based on modified properties
     */
    updateProps: function() {
        this.destroy();
        if( this.isActive() ) {
            this.draw();
        }
    },

    /**
     * Tell the renderer to update based on modified element position
     */
    updatePos: function() {
        this.isPositioned = true;
    },

    /**
     * Tell the renderer to update based on modified element dimensions
     */
    updateSize: function() {
        if( this.isActive() ) {
            this.draw();
        } else {
            this.destroy();
        }
    },


    /**
     * Add a layer element, with the given z-order index, to the renderer's main box element. We can't use
     * z-index because that breaks when the root rendering box's z-index is 'auto' in IE8+ standards mode.
     * So instead we make sure they are inserted into the DOM in the correct order.
     * @param {number} index
     * @param {Element} el
     */
    addLayer: function( index, el ) {
        this.removeLayer( index );
        for( var layers = this._layers || ( this._layers = [] ), i = index + 1, len = layers.length, layer; i < len; i++ ) {
            layer = layers[i];
            if( layer ) {
                break;
            }
        }
        layers[index] = el;
        this.getBox().insertBefore( el, layer || null );
    },

    /**
     * Retrieve a layer element by its index, or null if not present
     * @param {number} index
     * @return {Element}
     */
    getLayer: function( index ) {
        var layers = this._layers;
        return layers && layers[index] || null;
    },

    /**
     * Remove a layer element by its index
     * @param {number} index
     */
    removeLayer: function( index ) {
        var layer = this.getLayer( index ),
            box = this._box;
        if( layer && box ) {
            box.removeChild( layer );
            this._layers[index] = null;
        }
    },


    /**
     * Get a VML shape by name, creating it if necessary.
     * @param {string} name A name identifying the element
     * @param {string=} subElName If specified a subelement of the shape will be created with this tag name
     * @param {Element} parent The parent element for the shape; will be ignored if 'group' is specified
     * @param {number=} group If specified, an ordinal group for the shape. 1 or greater. Groups are rendered
     *                  using container elements in the correct order, to get correct z stacking without z-index.
     */
    getShape: function( name, subElName, parent, group ) {
        var shapes = this._shapes || ( this._shapes = {} ),
            shape = shapes[ name ],
            s;

        if( !shape ) {
            shape = shapes[ name ] = PIE.Util.createVmlElement( 'shape' );
            if( subElName ) {
                shape.appendChild( shape[ subElName ] = PIE.Util.createVmlElement( subElName ) );
            }

            if( group ) {
                parent = this.getLayer( group );
                if( !parent ) {
                    this.addLayer( group, doc.createElement( 'group' + group ) );
                    parent = this.getLayer( group );
                }
            }

            parent.appendChild( shape );

            s = shape.style;
            s.position = 'absolute';
            s.left = s.top = 0;
            s['behavior'] = 'url(#default#VML)';
        }
        return shape;
    },

    /**
     * Delete a named shape which was created by getShape(). Returns true if a shape with the
     * given name was found and deleted, or false if there was no shape of that name.
     * @param {string} name
     * @return {boolean}
     */
    deleteShape: function( name ) {
        var shapes = this._shapes,
            shape = shapes && shapes[ name ];
        if( shape ) {
            shape.parentNode.removeChild( shape );
            delete shapes[ name ];
        }
        return !!shape;
    },


    /**
     * For a given set of border radius length/percentage values, convert them to concrete pixel
     * values based on the current size of the target element.
     * @param {Object} radii
     * @return {Object}
     */
    getRadiiPixels: function( radii ) {
        var el = this.targetElement,
            bounds = this.boundsInfo.getBounds(),
            w = bounds.w,
            h = bounds.h,
            tlX, tlY, trX, trY, brX, brY, blX, blY, f;

        tlX = radii.x['tl'].pixels( el, w );
        tlY = radii.y['tl'].pixels( el, h );
        trX = radii.x['tr'].pixels( el, w );
        trY = radii.y['tr'].pixels( el, h );
        brX = radii.x['br'].pixels( el, w );
        brY = radii.y['br'].pixels( el, h );
        blX = radii.x['bl'].pixels( el, w );
        blY = radii.y['bl'].pixels( el, h );

        // If any corner ellipses overlap, reduce them all by the appropriate factor. This formula
        // is taken straight from the CSS3 Backgrounds and Borders spec.
        f = Math.min(
            w / ( tlX + trX ),
            h / ( trY + brY ),
            w / ( blX + brX ),
            h / ( tlY + blY )
        );
        if( f < 1 ) {
            tlX *= f;
            tlY *= f;
            trX *= f;
            trY *= f;
            brX *= f;
            brY *= f;
            blX *= f;
            blY *= f;
        }

        return {
            x: {
                'tl': tlX,
                'tr': trX,
                'br': brX,
                'bl': blX
            },
            y: {
                'tl': tlY,
                'tr': trY,
                'br': brY,
                'bl': blY
            }
        }
    },

    /**
     * Return the VML path string for the element's background box, with corners rounded.
     * @param {Object.<{t:number, r:number, b:number, l:number}>} shrink - if present, specifies number of
     *        pixels to shrink the box path inward from the element's four sides.
     * @param {number=} mult If specified, all coordinates will be multiplied by this number
     * @param {Object=} radii If specified, this will be used for the corner radii instead of the properties
     *        from this renderer's borderRadiusInfo object.
     * @return {string} the VML path
     */
    getBoxPath: function( shrink, mult, radii ) {
        mult = mult || 1;

        var r, str,
            bounds = this.boundsInfo.getBounds(),
            w = bounds.w * mult,
            h = bounds.h * mult,
            radInfo = this.styleInfos.borderRadiusInfo,
            floor = Math.floor, ceil = Math.ceil,
            shrinkT = shrink ? shrink.t * mult : 0,
            shrinkR = shrink ? shrink.r * mult : 0,
            shrinkB = shrink ? shrink.b * mult : 0,
            shrinkL = shrink ? shrink.l * mult : 0,
            tlX, tlY, trX, trY, brX, brY, blX, blY;

        if( radii || radInfo.isActive() ) {
            r = this.getRadiiPixels( radii || radInfo.getProps() );

            tlX = r.x['tl'] * mult;
            tlY = r.y['tl'] * mult;
            trX = r.x['tr'] * mult;
            trY = r.y['tr'] * mult;
            brX = r.x['br'] * mult;
            brY = r.y['br'] * mult;
            blX = r.x['bl'] * mult;
            blY = r.y['bl'] * mult;

            str = 'm' + floor( shrinkL ) + ',' + floor( tlY ) +
                'qy' + floor( tlX ) + ',' + floor( shrinkT ) +
                'l' + ceil( w - trX ) + ',' + floor( shrinkT ) +
                'qx' + ceil( w - shrinkR ) + ',' + floor( trY ) +
                'l' + ceil( w - shrinkR ) + ',' + ceil( h - brY ) +
                'qy' + ceil( w - brX ) + ',' + ceil( h - shrinkB ) +
                'l' + floor( blX ) + ',' + ceil( h - shrinkB ) +
                'qx' + floor( shrinkL ) + ',' + ceil( h - blY ) + ' x e';
        } else {
            // simplified path for non-rounded box
            str = 'm' + floor( shrinkL ) + ',' + floor( shrinkT ) +
                  'l' + ceil( w - shrinkR ) + ',' + floor( shrinkT ) +
                  'l' + ceil( w - shrinkR ) + ',' + ceil( h - shrinkB ) +
                  'l' + floor( shrinkL ) + ',' + ceil( h - shrinkB ) +
                  'xe';
        }
        return str;
    },


    /**
     * Get the container element for the shapes, creating it if necessary.
     */
    getBox: function() {
        var box = this.parent.getLayer( this.boxZIndex ), s;

        if( !box ) {
            box = doc.createElement( this.boxName );
            s = box.style;
            s.position = 'absolute';
            s.top = s.left = 0;
            this.parent.addLayer( this.boxZIndex, box );
        }

        return box;
    },


    /**
     * Hide the actual border of the element. In IE7 and up we can just set its color to transparent;
     * however IE6 does not support transparent borders so we have to get tricky with it. Also, some elements
     * like form buttons require removing the border width altogether, so for those we increase the padding
     * by the border size.
     */
    hideBorder: function() {
        var el = this.targetElement,
            cs = el.currentStyle,
            rs = el.runtimeStyle,
            tag = el.tagName,
            isIE6 = PIE.ieVersion === 6,
            sides, side, i;

        if( ( isIE6 && ( tag in PIE.childlessElements || tag === 'FIELDSET' ) ) ||
                tag === 'BUTTON' || ( tag === 'INPUT' && el.type in PIE.inputButtonTypes ) ) {
            rs.borderWidth = '';
            sides = this.styleInfos.borderInfo.sides;
            for( i = sides.length; i--; ) {
                side = sides[ i ];
                rs[ 'padding' + side ] = '';
                rs[ 'padding' + side ] = ( PIE.getLength( cs[ 'padding' + side ] ) ).pixels( el ) +
                                         ( PIE.getLength( cs[ 'border' + side + 'Width' ] ) ).pixels( el ) +
                                         ( PIE.ieVersion !== 8 && i % 2 ? 1 : 0 ); //needs an extra horizontal pixel to counteract the extra "inner border" going away
            }
            rs.borderWidth = 0;
        }
        else if( isIE6 ) {
            // Wrap all the element's children in a custom element, set the element to visiblity:hidden,
            // and set the wrapper element to visiblity:visible. This hides the outer element's decorations
            // (background and border) but displays all the contents.
            // TODO find a better way to do this that doesn't mess up the DOM parent-child relationship,
            // as this can interfere with other author scripts which add/modify/delete children. Also, this
            // won't work for elements which cannot take children, e.g. input/button/textarea/img/etc. Look into
            // using a compositor filter or some other filter which masks the border.
            if( el.childNodes.length !== 1 || el.firstChild.tagName !== 'ie6-mask' ) {
                var cont = doc.createElement( 'ie6-mask' ),
                    s = cont.style, child;
                s.visibility = 'visible';
                s.zoom = 1;
                while( child = el.firstChild ) {
                    cont.appendChild( child );
                }
                el.appendChild( cont );
                rs.visibility = 'hidden';
            }
        }
        else {
            rs.borderColor = 'transparent';
        }
    },

    unhideBorder: function() {
        
    },


    /**
     * Destroy the rendered objects. This is a base implementation which handles common renderer
     * structures, but individual renderers may override as necessary.
     */
    destroy: function() {
        this.parent.removeLayer( this.boxZIndex );
        delete this._shapes;
        delete this._layers;
    }
};
/**
 * Root renderer; creates the outermost container element and handles keeping it aligned
 * with the target element's size and position.
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 */
PIE.RootRenderer = PIE.RendererBase.newRenderer( {

    isActive: function() {
        var children = this.childRenderers;
        for( var i in children ) {
            if( children.hasOwnProperty( i ) && children[ i ].isActive() ) {
                return true;
            }
        }
        return false;
    },

    needsUpdate: function() {
        return this.styleInfos.visibilityInfo.changed();
    },

    updatePos: function() {
        if( this.isActive() ) {
            var el = this.getPositioningElement(),
                par = el,
                docEl,
                parRect,
                tgtCS = el.currentStyle,
                tgtPos = tgtCS.position,
                boxPos,
                s = this.getBox().style, cs,
                x = 0, y = 0,
                elBounds = this.boundsInfo.getBounds(),
                logicalZoomRatio = elBounds.logicalZoomRatio;

            if( tgtPos === 'fixed' && PIE.ieVersion > 6 ) {
                x = elBounds.x * logicalZoomRatio;
                y = elBounds.y * logicalZoomRatio;
                boxPos = tgtPos;
            } else {
                // Get the element's offsets from its nearest positioned ancestor. Uses
                // getBoundingClientRect for accuracy and speed.
                do {
                    par = par.offsetParent;
                } while( par && ( par.currentStyle.position === 'static' ) );
                if( par ) {
                    parRect = par.getBoundingClientRect();
                    cs = par.currentStyle;
                    x = ( elBounds.x - parRect.left ) * logicalZoomRatio - ( parseFloat(cs.borderLeftWidth) || 0 );
                    y = ( elBounds.y - parRect.top ) * logicalZoomRatio - ( parseFloat(cs.borderTopWidth) || 0 );
                } else {
                    docEl = doc.documentElement;
                    x = ( elBounds.x + docEl.scrollLeft - docEl.clientLeft ) * logicalZoomRatio;
                    y = ( elBounds.y + docEl.scrollTop - docEl.clientTop ) * logicalZoomRatio;
                }
                boxPos = 'absolute';
            }

            s.position = boxPos;
            s.left = x;
            s.top = y;
            s.zIndex = tgtPos === 'static' ? -1 : tgtCS.zIndex;
            this.isPositioned = true;
        }
    },

    updateSize: PIE.emptyFn,

    updateVisibility: function() {
        var vis = this.styleInfos.visibilityInfo.getProps();
        this.getBox().style.display = ( vis.visible && vis.displayed ) ? '' : 'none';
    },

    updateProps: function() {
        if( this.isActive() ) {
            this.updateVisibility();
        } else {
            this.destroy();
        }
    },

    getPositioningElement: function() {
        var el = this.targetElement;
        return el.tagName in PIE.tableCellTags ? el.offsetParent : el;
    },

    getBox: function() {
        var box = this._box, el;
        if( !box ) {
            el = this.getPositioningElement();
            box = this._box = doc.createElement( 'css3-container' );
            box.style['direction'] = 'ltr'; //fix positioning bug in rtl environments

            this.updateVisibility();

            el.parentNode.insertBefore( box, el );
        }
        return box;
    },

    finishUpdate: PIE.emptyFn,

    destroy: function() {
        var box = this._box, par;
        if( box && ( par = box.parentNode ) ) {
            par.removeChild( box );
        }
        delete this._box;
        delete this._layers;
    }

} );
/**
 * Renderer for element backgrounds.
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 * @param {PIE.RootRenderer} parent
 */
PIE.BackgroundRenderer = PIE.RendererBase.newRenderer( {

    boxZIndex: 2,
    boxName: 'background',

    needsUpdate: function() {
        var si = this.styleInfos;
        return si.backgroundInfo.changed() || si.borderRadiusInfo.changed();
    },

    isActive: function() {
        var si = this.styleInfos;
        return si.borderImageInfo.isActive() ||
               si.borderRadiusInfo.isActive() ||
               si.backgroundInfo.isActive() ||
               ( si.boxShadowInfo.isActive() && si.boxShadowInfo.getProps().inset );
    },

    /**
     * Draw the shapes
     */
    draw: function() {
        var bounds = this.boundsInfo.getBounds();
        if( bounds.w && bounds.h ) {
            this.drawBgColor();
            this.drawBgImages();
        }
    },

    /**
     * Draw the background color shape
     */
    drawBgColor: function() {
        var props = this.styleInfos.backgroundInfo.getProps(),
            bounds = this.boundsInfo.getBounds(),
            el = this.targetElement,
            color = props && props.color,
            shape, w, h, s, alpha;

        if( color && color.alpha() > 0 ) {
            this.hideBackground();

            shape = this.getShape( 'bgColor', 'fill', this.getBox(), 1 );
            w = bounds.w;
            h = bounds.h;
            shape.stroked = false;
            shape.coordsize = w * 2 + ',' + h * 2;
            shape.coordorigin = '1,1';
            shape.path = this.getBoxPath( null, 2 );
            s = shape.style;
            s.width = w;
            s.height = h;
            shape.fill.color = color.colorValue( el );

            alpha = color.alpha();
            if( alpha < 1 ) {
                shape.fill.opacity = alpha;
            }
        } else {
            this.deleteShape( 'bgColor' );
        }
    },

    /**
     * Draw all the background image layers
     */
    drawBgImages: function() {
        var props = this.styleInfos.backgroundInfo.getProps(),
            bounds = this.boundsInfo.getBounds(),
            images = props && props.bgImages,
            img, shape, w, h, s, i;

        if( images ) {
            this.hideBackground();

            w = bounds.w;
            h = bounds.h;

            i = images.length;
            while( i-- ) {
                img = images[i];
                shape = this.getShape( 'bgImage' + i, 'fill', this.getBox(), 2 );

                shape.stroked = false;
                shape.fill.type = 'tile';
                shape.fillcolor = 'none';
                shape.coordsize = w * 2 + ',' + h * 2;
                shape.coordorigin = '1,1';
                shape.path = this.getBoxPath( 0, 2 );
                s = shape.style;
                s.width = w;
                s.height = h;

                if( img.imgType === 'linear-gradient' ) {
                    this.addLinearGradient( shape, img );
                }
                else {
                    shape.fill.src = img.imgUrl;
                    this.positionBgImage( shape, i );
                }
            }
        }

        // Delete any bgImage shapes previously created which weren't used above
        i = images ? images.length : 0;
        while( this.deleteShape( 'bgImage' + i++ ) ) {}
    },


    /**
     * Set the position and clipping of the background image for a layer
     * @param {Element} shape
     * @param {number} index
     */
    positionBgImage: function( shape, index ) {
        var me = this;
        PIE.Util.withImageSize( shape.fill.src, function( size ) {
            var el = me.targetElement,
                bounds = me.boundsInfo.getBounds(),
                elW = bounds.w,
                elH = bounds.h;

            // It's possible that the element dimensions are zero now but weren't when the original
            // update executed, make sure that's not the case to avoid divide-by-zero error
            if( elW && elH ) {
                var fill = shape.fill,
                    si = me.styleInfos,
                    border = si.borderInfo.getProps(),
                    bw = border && border.widths,
                    bwT = bw ? bw['t'].pixels( el ) : 0,
                    bwR = bw ? bw['r'].pixels( el ) : 0,
                    bwB = bw ? bw['b'].pixels( el ) : 0,
                    bwL = bw ? bw['l'].pixels( el ) : 0,
                    bg = si.backgroundInfo.getProps().bgImages[ index ],
                    bgPos = bg.bgPosition ? bg.bgPosition.coords( el, elW - size.w - bwL - bwR, elH - size.h - bwT - bwB ) : { x:0, y:0 },
                    repeat = bg.imgRepeat,
                    pxX, pxY,
                    clipT = 0, clipL = 0,
                    clipR = elW + 1, clipB = elH + 1, //make sure the default clip region is not inside the box (by a subpixel)
                    clipAdjust = PIE.ieVersion === 8 ? 0 : 1; //prior to IE8 requires 1 extra pixel in the image clip region

                // Positioning - find the pixel offset from the top/left and convert to a ratio
                // The position is shifted by half a pixel, to adjust for the half-pixel coordorigin shift which is
                // needed to fix antialiasing but makes the bg image fuzzy.
                pxX = Math.round( bgPos.x ) + bwL + 0.5;
                pxY = Math.round( bgPos.y ) + bwT + 0.5;
                fill.position = ( pxX / elW ) + ',' + ( pxY / elH );

                // Set the size of the image. We have to actually set it to px values otherwise it will not honor
                // the user's browser zoom level and always display at its natural screen size.
                fill['size']['x'] = 1; //Can be any value, just has to be set to "prime" it so the next line works. Weird!
                fill['size'] = size.w + 'px,' + size.h + 'px';

                // Repeating - clip the image shape
                if( repeat && repeat !== 'repeat' ) {
                    if( repeat === 'repeat-x' || repeat === 'no-repeat' ) {
                        clipT = pxY + 1;
                        clipB = pxY + size.h + clipAdjust;
                    }
                    if( repeat === 'repeat-y' || repeat === 'no-repeat' ) {
                        clipL = pxX + 1;
                        clipR = pxX + size.w + clipAdjust;
                    }
                    shape.style.clip = 'rect(' + clipT + 'px,' + clipR + 'px,' + clipB + 'px,' + clipL + 'px)';
                }
            }
        } );
    },


    /**
     * Draw the linear gradient for a gradient layer
     * @param {Element} shape
     * @param {Object} info The object holding the information about the gradient
     */
    addLinearGradient: function( shape, info ) {
        var el = this.targetElement,
            bounds = this.boundsInfo.getBounds(),
            w = bounds.w,
            h = bounds.h,
            fill = shape.fill,
            stops = info.stops,
            stopCount = stops.length,
            PI = Math.PI,
            GradientUtil = PIE.GradientUtil,
            perpendicularIntersect = GradientUtil.perpendicularIntersect,
            distance = GradientUtil.distance,
            metrics = GradientUtil.getGradientMetrics( el, w, h, info ),
            angle = metrics.angle,
            startX = metrics.startX,
            startY = metrics.startY,
            startCornerX = metrics.startCornerX,
            startCornerY = metrics.startCornerY,
            endCornerX = metrics.endCornerX,
            endCornerY = metrics.endCornerY,
            deltaX = metrics.deltaX,
            deltaY = metrics.deltaY,
            lineLength = metrics.lineLength,
            vmlAngle, vmlGradientLength, vmlColors,
            stopPx, vmlOffsetPct,
            p, i, j, before, after;

        // In VML land, the angle of the rendered gradient depends on the aspect ratio of the shape's
        // bounding box; for example specifying a 45 deg angle actually results in a gradient
        // drawn diagonally from one corner to its opposite corner, which will only appear to the
        // viewer as 45 degrees if the shape is equilateral.  We adjust for this by taking the x/y deltas
        // between the start and end points, multiply one of them by the shape's aspect ratio,
        // and get their arctangent, resulting in an appropriate VML angle. If the angle is perfectly
        // horizontal or vertical then we don't need to do this conversion.
        vmlAngle = ( angle % 90 ) ? Math.atan2( deltaX * w / h, deltaY ) / PI * 180 : ( angle + 90 );

        // VML angles are 180 degrees offset from CSS angles
        vmlAngle += 180;
        vmlAngle = vmlAngle % 360;

        // Add all the stops to the VML 'colors' list, including the first and last stops.
        // For each, we find its pixel offset along the gradient-line; if the offset of a stop is less
        // than that of its predecessor we increase it to be equal. We then map that pixel offset to a
        // percentage along the VML gradient-line, which runs from shape corner to corner.
        p = perpendicularIntersect( startCornerX, startCornerY, angle, endCornerX, endCornerY );
        vmlGradientLength = distance( startCornerX, startCornerY, p[0], p[1] );
        vmlColors = [];
        p = perpendicularIntersect( startX, startY, angle, startCornerX, startCornerY );
        vmlOffsetPct = distance( startX, startY, p[0], p[1] ) / vmlGradientLength * 100;

        // Find the pixel offsets along the CSS3 gradient-line for each stop.
        stopPx = [];
        for( i = 0; i < stopCount; i++ ) {
            stopPx.push( stops[i].offset ? stops[i].offset.pixels( el, lineLength ) :
                         i === 0 ? 0 : i === stopCount - 1 ? lineLength : null );
        }
        // Fill in gaps with evenly-spaced offsets
        for( i = 1; i < stopCount; i++ ) {
            if( stopPx[ i ] === null ) {
                before = stopPx[ i - 1 ];
                j = i;
                do {
                    after = stopPx[ ++j ];
                } while( after === null );
                stopPx[ i ] = before + ( after - before ) / ( j - i + 1 );
            }
            // Make sure each stop's offset is no less than the one before it
            stopPx[ i ] = Math.max( stopPx[ i ], stopPx[ i - 1 ] );
        }

        // Convert to percentage along the VML gradient line and add to the VML 'colors' value
        for( i = 0; i < stopCount; i++ ) {
            vmlColors.push(
                ( vmlOffsetPct + ( stopPx[ i ] / vmlGradientLength * 100 ) ) + '% ' + stops[i].color.colorValue( el )
            );
        }

        // Now, finally, we're ready to render the gradient fill. Set the start and end colors to
        // the first and last stop colors; this just sets outer bounds for the gradient.
        fill['angle'] = vmlAngle;
        fill['type'] = 'gradient';
        fill['method'] = 'sigma';
        fill['color'] = stops[0].color.colorValue( el );
        fill['color2'] = stops[stopCount - 1].color.colorValue( el );
        if( fill['colors'] ) { //sometimes the colors object isn't initialized so we have to assign it directly (?)
            fill['colors'].value = vmlColors.join( ',' );
        } else {
            fill['colors'] = vmlColors.join( ',' );
        }
    },


    /**
     * Hide the actual background image and color of the element.
     */
    hideBackground: function() {
        var rs = this.targetElement.runtimeStyle;
        rs.backgroundImage = 'url(about:blank)'; //ensures the background area reacts to mouse events
        rs.backgroundColor = 'transparent';
    },

    destroy: function() {
        PIE.RendererBase.destroy.call( this );
        var rs = this.targetElement.runtimeStyle;
        rs.backgroundImage = rs.backgroundColor = '';
    }

} );
/**
 * Renderer for element borders.
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 * @param {PIE.RootRenderer} parent
 */
PIE.BorderRenderer = PIE.RendererBase.newRenderer( {

    boxZIndex: 4,
    boxName: 'border',

    needsUpdate: function() {
        var si = this.styleInfos;
        return si.borderInfo.changed() || si.borderRadiusInfo.changed();
    },

    isActive: function() {
        var si = this.styleInfos;
        return si.borderRadiusInfo.isActive() &&
               !si.borderImageInfo.isActive() &&
               si.borderInfo.isActive(); //check BorderStyleInfo last because it's the most expensive
    },

    /**
     * Draw the border shape(s)
     */
    draw: function() {
        var el = this.targetElement,
            props = this.styleInfos.borderInfo.getProps(),
            bounds = this.boundsInfo.getBounds(),
            w = bounds.w,
            h = bounds.h,
            shape, stroke, s,
            segments, seg, i, len;

        if( props ) {
            this.hideBorder();

            segments = this.getBorderSegments( 2 );
            for( i = 0, len = segments.length; i < len; i++) {
                seg = segments[i];
                shape = this.getShape( 'borderPiece' + i, seg.stroke ? 'stroke' : 'fill', this.getBox() );
                shape.coordsize = w * 2 + ',' + h * 2;
                shape.coordorigin = '1,1';
                shape.path = seg.path;
                s = shape.style;
                s.width = w;
                s.height = h;

                shape.filled = !!seg.fill;
                shape.stroked = !!seg.stroke;
                if( seg.stroke ) {
                    stroke = shape.stroke;
                    stroke['weight'] = seg.weight + 'px';
                    stroke.color = seg.color.colorValue( el );
                    stroke['dashstyle'] = seg.stroke === 'dashed' ? '2 2' : seg.stroke === 'dotted' ? '1 1' : 'solid';
                    stroke['linestyle'] = seg.stroke === 'double' && seg.weight > 2 ? 'ThinThin' : 'Single';
                } else {
                    shape.fill.color = seg.fill.colorValue( el );
                }
            }

            // remove any previously-created border shapes which didn't get used above
            while( this.deleteShape( 'borderPiece' + i++ ) ) {}
        }
    },


    /**
     * Get the VML path definitions for the border segment(s).
     * @param {number=} mult If specified, all coordinates will be multiplied by this number
     * @return {Array.<string>}
     */
    getBorderSegments: function( mult ) {
        var el = this.targetElement,
            bounds, elW, elH,
            borderInfo = this.styleInfos.borderInfo,
            segments = [],
            floor, ceil, wT, wR, wB, wL,
            round = Math.round,
            borderProps, radiusInfo, radii, widths, styles, colors;

        if( borderInfo.isActive() ) {
            borderProps = borderInfo.getProps();

            widths = borderProps.widths;
            styles = borderProps.styles;
            colors = borderProps.colors;

            if( borderProps.widthsSame && borderProps.stylesSame && borderProps.colorsSame ) {
                if( colors['t'].alpha() > 0 ) {
                    // shortcut for identical border on all sides - only need 1 stroked shape
                    wT = widths['t'].pixels( el ); //thickness
                    wR = wT / 2; //shrink
                    segments.push( {
                        path: this.getBoxPath( { t: wR, r: wR, b: wR, l: wR }, mult ),
                        stroke: styles['t'],
                        color: colors['t'],
                        weight: wT
                    } );
                }
            }
            else {
                mult = mult || 1;
                bounds = this.boundsInfo.getBounds();
                elW = bounds.w;
                elH = bounds.h;

                wT = round( widths['t'].pixels( el ) );
                wR = round( widths['r'].pixels( el ) );
                wB = round( widths['b'].pixels( el ) );
                wL = round( widths['l'].pixels( el ) );
                var pxWidths = {
                    't': wT,
                    'r': wR,
                    'b': wB,
                    'l': wL
                };

                radiusInfo = this.styleInfos.borderRadiusInfo;
                if( radiusInfo.isActive() ) {
                    radii = this.getRadiiPixels( radiusInfo.getProps() );
                }

                floor = Math.floor;
                ceil = Math.ceil;

                function radius( xy, corner ) {
                    return radii ? radii[ xy ][ corner ] : 0;
                }

                function curve( corner, shrinkX, shrinkY, startAngle, ccw, doMove ) {
                    var rx = radius( 'x', corner),
                        ry = radius( 'y', corner),
                        deg = 65535,
                        isRight = corner.charAt( 1 ) === 'r',
                        isBottom = corner.charAt( 0 ) === 'b';
                    return ( rx > 0 && ry > 0 ) ?
                                ( doMove ? 'al' : 'ae' ) +
                                ( isRight ? ceil( elW - rx ) : floor( rx ) ) * mult + ',' + // center x
                                ( isBottom ? ceil( elH - ry ) : floor( ry ) ) * mult + ',' + // center y
                                ( floor( rx ) - shrinkX ) * mult + ',' + // width
                                ( floor( ry ) - shrinkY ) * mult + ',' + // height
                                ( startAngle * deg ) + ',' + // start angle
                                ( 45 * deg * ( ccw ? 1 : -1 ) // angle change
                            ) : (
                                ( doMove ? 'm' : 'l' ) +
                                ( isRight ? elW - shrinkX : shrinkX ) * mult + ',' +
                                ( isBottom ? elH - shrinkY : shrinkY ) * mult
                            );
                }

                function line( side, shrink, ccw, doMove ) {
                    var
                        start = (
                            side === 't' ?
                                floor( radius( 'x', 'tl') ) * mult + ',' + ceil( shrink ) * mult :
                            side === 'r' ?
                                ceil( elW - shrink ) * mult + ',' + floor( radius( 'y', 'tr') ) * mult :
                            side === 'b' ?
                                ceil( elW - radius( 'x', 'br') ) * mult + ',' + floor( elH - shrink ) * mult :
                            // side === 'l' ?
                                floor( shrink ) * mult + ',' + ceil( elH - radius( 'y', 'bl') ) * mult
                        ),
                        end = (
                            side === 't' ?
                                ceil( elW - radius( 'x', 'tr') ) * mult + ',' + ceil( shrink ) * mult :
                            side === 'r' ?
                                ceil( elW - shrink ) * mult + ',' + ceil( elH - radius( 'y', 'br') ) * mult :
                            side === 'b' ?
                                floor( radius( 'x', 'bl') ) * mult + ',' + floor( elH - shrink ) * mult :
                            // side === 'l' ?
                                floor( shrink ) * mult + ',' + floor( radius( 'y', 'tl') ) * mult
                        );
                    return ccw ? ( doMove ? 'm' + end : '' ) + 'l' + start :
                                 ( doMove ? 'm' + start : '' ) + 'l' + end;
                }


                function addSide( side, sideBefore, sideAfter, cornerBefore, cornerAfter, baseAngle ) {
                    var vert = side === 'l' || side === 'r',
                        sideW = pxWidths[ side ],
                        beforeX, beforeY, afterX, afterY;

                    if( sideW > 0 && styles[ side ] !== 'none' && colors[ side ].alpha() > 0 ) {
                        beforeX = pxWidths[ vert ? side : sideBefore ];
                        beforeY = pxWidths[ vert ? sideBefore : side ];
                        afterX = pxWidths[ vert ? side : sideAfter ];
                        afterY = pxWidths[ vert ? sideAfter : side ];

                        if( styles[ side ] === 'dashed' || styles[ side ] === 'dotted' ) {
                            segments.push( {
                                path: curve( cornerBefore, beforeX, beforeY, baseAngle + 45, 0, 1 ) +
                                      curve( cornerBefore, 0, 0, baseAngle, 1, 0 ),
                                fill: colors[ side ]
                            } );
                            segments.push( {
                                path: line( side, sideW / 2, 0, 1 ),
                                stroke: styles[ side ],
                                weight: sideW,
                                color: colors[ side ]
                            } );
                            segments.push( {
                                path: curve( cornerAfter, afterX, afterY, baseAngle, 0, 1 ) +
                                      curve( cornerAfter, 0, 0, baseAngle - 45, 1, 0 ),
                                fill: colors[ side ]
                            } );
                        }
                        else {
                            segments.push( {
                                path: curve( cornerBefore, beforeX, beforeY, baseAngle + 45, 0, 1 ) +
                                      line( side, sideW, 0, 0 ) +
                                      curve( cornerAfter, afterX, afterY, baseAngle, 0, 0 ) +

                                      ( styles[ side ] === 'double' && sideW > 2 ?
                                              curve( cornerAfter, afterX - floor( afterX / 3 ), afterY - floor( afterY / 3 ), baseAngle - 45, 1, 0 ) +
                                              line( side, ceil( sideW / 3 * 2 ), 1, 0 ) +
                                              curve( cornerBefore, beforeX - floor( beforeX / 3 ), beforeY - floor( beforeY / 3 ), baseAngle, 1, 0 ) +
                                              'x ' +
                                              curve( cornerBefore, floor( beforeX / 3 ), floor( beforeY / 3 ), baseAngle + 45, 0, 1 ) +
                                              line( side, floor( sideW / 3 ), 1, 0 ) +
                                              curve( cornerAfter, floor( afterX / 3 ), floor( afterY / 3 ), baseAngle, 0, 0 )
                                          : '' ) +

                                      curve( cornerAfter, 0, 0, baseAngle - 45, 1, 0 ) +
                                      line( side, 0, 1, 0 ) +
                                      curve( cornerBefore, 0, 0, baseAngle, 1, 0 ),
                                fill: colors[ side ]
                            } );
                        }
                    }
                }

                addSide( 't', 'l', 'r', 'tl', 'tr', 90 );
                addSide( 'r', 't', 'b', 'tr', 'br', 0 );
                addSide( 'b', 'r', 'l', 'br', 'bl', -90 );
                addSide( 'l', 'b', 't', 'bl', 'tl', -180 );
            }
        }

        return segments;
    },

    destroy: function() {
        var me = this;
        if (me.finalized || !me.styleInfos.borderImageInfo.isActive()) {
            me.targetElement.runtimeStyle.borderColor = '';
        }
        PIE.RendererBase.destroy.call( me );
    }


} );
/**
 * Renderer for border-image
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 * @param {PIE.RootRenderer} parent
 */
PIE.BorderImageRenderer = PIE.RendererBase.newRenderer( {

    boxZIndex: 5,
    pieceNames: [ 't', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl', 'c' ],

    needsUpdate: function() {
        return this.styleInfos.borderImageInfo.changed();
    },

    isActive: function() {
        return this.styleInfos.borderImageInfo.isActive();
    },

    draw: function() {
        this.getBox(); //make sure pieces are created

        var props = this.styleInfos.borderImageInfo.getProps(),
            borderProps = this.styleInfos.borderInfo.getProps(),
            bounds = this.boundsInfo.getBounds(),
            el = this.targetElement,
            pieces = this.pieces;

        PIE.Util.withImageSize( props.src, function( imgSize ) {
            var elW = bounds.w,
                elH = bounds.h,
                zero = PIE.getLength( '0' ),
                widths = props.widths || ( borderProps ? borderProps.widths : { 't': zero, 'r': zero, 'b': zero, 'l': zero } ),
                widthT = widths['t'].pixels( el ),
                widthR = widths['r'].pixels( el ),
                widthB = widths['b'].pixels( el ),
                widthL = widths['l'].pixels( el ),
                slices = props.slice,
                sliceT = slices['t'].pixels( el ),
                sliceR = slices['r'].pixels( el ),
                sliceB = slices['b'].pixels( el ),
                sliceL = slices['l'].pixels( el );

            // Piece positions and sizes
            function setSizeAndPos( piece, w, h, x, y ) {
                var s = pieces[piece].style,
                    max = Math.max;
                s.width = max(w, 0);
                s.height = max(h, 0);
                s.left = x;
                s.top = y;
            }
            setSizeAndPos( 'tl', widthL, widthT, 0, 0 );
            setSizeAndPos( 't', elW - widthL - widthR, widthT, widthL, 0 );
            setSizeAndPos( 'tr', widthR, widthT, elW - widthR, 0 );
            setSizeAndPos( 'r', widthR, elH - widthT - widthB, elW - widthR, widthT );
            setSizeAndPos( 'br', widthR, widthB, elW - widthR, elH - widthB );
            setSizeAndPos( 'b', elW - widthL - widthR, widthB, widthL, elH - widthB );
            setSizeAndPos( 'bl', widthL, widthB, 0, elH - widthB );
            setSizeAndPos( 'l', widthL, elH - widthT - widthB, 0, widthT );
            setSizeAndPos( 'c', elW - widthL - widthR, elH - widthT - widthB, widthL, widthT );


            // image croppings
            function setCrops( sides, crop, val ) {
                for( var i=0, len=sides.length; i < len; i++ ) {
                    pieces[ sides[i] ]['imagedata'][ crop ] = val;
                }
            }

            // corners
            setCrops( [ 'tl', 't', 'tr' ], 'cropBottom', ( imgSize.h - sliceT ) / imgSize.h );
            setCrops( [ 'tl', 'l', 'bl' ], 'cropRight', ( imgSize.w - sliceL ) / imgSize.w );
            setCrops( [ 'bl', 'b', 'br' ], 'cropTop', ( imgSize.h - sliceB ) / imgSize.h );
            setCrops( [ 'tr', 'r', 'br' ], 'cropLeft', ( imgSize.w - sliceR ) / imgSize.w );

            // edges and center
            // TODO right now this treats everything like 'stretch', need to support other schemes
            //if( props.repeat.v === 'stretch' ) {
                setCrops( [ 'l', 'r', 'c' ], 'cropTop', sliceT / imgSize.h );
                setCrops( [ 'l', 'r', 'c' ], 'cropBottom', sliceB / imgSize.h );
            //}
            //if( props.repeat.h === 'stretch' ) {
                setCrops( [ 't', 'b', 'c' ], 'cropLeft', sliceL / imgSize.w );
                setCrops( [ 't', 'b', 'c' ], 'cropRight', sliceR / imgSize.w );
            //}

            // center fill
            pieces['c'].style.display = props.fill ? '' : 'none';
        }, this );
    },

    getBox: function() {
        var box = this.parent.getLayer( this.boxZIndex ),
            s, piece, i,
            pieceNames = this.pieceNames,
            len = pieceNames.length;

        if( !box ) {
            box = doc.createElement( 'border-image' );
            s = box.style;
            s.position = 'absolute';

            this.pieces = {};

            for( i = 0; i < len; i++ ) {
                piece = this.pieces[ pieceNames[i] ] = PIE.Util.createVmlElement( 'rect' );
                piece.appendChild( PIE.Util.createVmlElement( 'imagedata' ) );
                s = piece.style;
                s['behavior'] = 'url(#default#VML)';
                s.position = "absolute";
                s.top = s.left = 0;
                piece['imagedata'].src = this.styleInfos.borderImageInfo.getProps().src;
                piece.stroked = false;
                piece.filled = false;
                box.appendChild( piece );
            }

            this.parent.addLayer( this.boxZIndex, box );
        }

        return box;
    },

    prepareUpdate: function() {
        if (this.isActive()) {
            var me = this,
                el = me.targetElement,
                rs = el.runtimeStyle,
                widths = me.styleInfos.borderImageInfo.getProps().widths;

            // Force border-style to solid so it doesn't collapse
            rs.borderStyle = 'solid';

            // If widths specified in border-image shorthand, override border-width
            // NOTE px units needed here as this gets used by the IE9 renderer too
            if ( widths ) {
                rs.borderTopWidth = widths['t'].pixels( el ) + 'px';
                rs.borderRightWidth = widths['r'].pixels( el ) + 'px';
                rs.borderBottomWidth = widths['b'].pixels( el ) + 'px';
                rs.borderLeftWidth = widths['l'].pixels( el ) + 'px';
            }

            // Make the border transparent
            me.hideBorder();
        }
    },

    destroy: function() {
        var me = this,
            rs = me.targetElement.runtimeStyle;
        rs.borderStyle = '';
        if (me.finalized || !me.styleInfos.borderInfo.isActive()) {
            rs.borderColor = rs.borderWidth = '';
        }
        PIE.RendererBase.destroy.call( this );
    }

} );
/**
 * Renderer for outset box-shadows
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 * @param {PIE.RootRenderer} parent
 */
PIE.BoxShadowOutsetRenderer = PIE.RendererBase.newRenderer( {

    boxZIndex: 1,
    boxName: 'outset-box-shadow',

    needsUpdate: function() {
        var si = this.styleInfos;
        return si.boxShadowInfo.changed() || si.borderRadiusInfo.changed();
    },

    isActive: function() {
        var boxShadowInfo = this.styleInfos.boxShadowInfo;
        return boxShadowInfo.isActive() && boxShadowInfo.getProps().outset[0];
    },

    draw: function() {
        var me = this,
            el = this.targetElement,
            box = this.getBox(),
            styleInfos = this.styleInfos,
            shadowInfos = styleInfos.boxShadowInfo.getProps().outset,
            radii = styleInfos.borderRadiusInfo.getProps(),
            len = shadowInfos.length,
            i = len, j,
            bounds = this.boundsInfo.getBounds(),
            w = bounds.w,
            h = bounds.h,
            clipAdjust = PIE.ieVersion === 8 ? 1 : 0, //workaround for IE8 bug where VML leaks out top/left of clip region by 1px
            corners = [ 'tl', 'tr', 'br', 'bl' ], corner,
            shadowInfo, shape, fill, ss, xOff, yOff, spread, blur, shrink, color, alpha, path,
            totalW, totalH, focusX, focusY, isBottom, isRight;


        function getShadowShape( index, corner, xOff, yOff, color, blur, path ) {
            var shape = me.getShape( 'shadow' + index + corner, 'fill', box, len - index ),
                fill = shape.fill;

            // Position and size
            shape['coordsize'] = w * 2 + ',' + h * 2;
            shape['coordorigin'] = '1,1';

            // Color and opacity
            shape['stroked'] = false;
            shape['filled'] = true;
            fill.color = color.colorValue( el );
            if( blur ) {
                fill['type'] = 'gradienttitle'; //makes the VML gradient follow the shape's outline - hooray for undocumented features?!?!
                fill['color2'] = fill.color;
                fill['opacity'] = 0;
            }

            // Path
            shape.path = path;

            // This needs to go last for some reason, to prevent rendering at incorrect size
            ss = shape.style;
            ss.left = xOff;
            ss.top = yOff;
            ss.width = w;
            ss.height = h;

            return shape;
        }


        while( i-- ) {
            shadowInfo = shadowInfos[ i ];
            xOff = shadowInfo.xOffset.pixels( el );
            yOff = shadowInfo.yOffset.pixels( el );
            spread = shadowInfo.spread.pixels( el );
            blur = shadowInfo.blur.pixels( el );
            color = shadowInfo.color;
            // Shape path
            shrink = -spread - blur;
            if( !radii && blur ) {
                // If blurring, use a non-null border radius info object so that getBoxPath will
                // round the corners of the expanded shadow shape rather than squaring them off.
                radii = PIE.BorderRadiusStyleInfo.ALL_ZERO;
            }
            path = this.getBoxPath( { t: shrink, r: shrink, b: shrink, l: shrink }, 2, radii );

            if( blur ) {
                totalW = ( spread + blur ) * 2 + w;
                totalH = ( spread + blur ) * 2 + h;
                focusX = totalW ? blur * 2 / totalW : 0;
                focusY = totalH ? blur * 2 / totalH : 0;
                if( blur - spread > w / 2 || blur - spread > h / 2 ) {
                    // If the blur is larger than half the element's narrowest dimension, we cannot do
                    // this with a single shape gradient, because its focussize would have to be less than
                    // zero which results in ugly artifacts. Instead we create four shapes, each with its
                    // gradient focus past center, and then clip them so each only shows the quadrant
                    // opposite the focus.
                    for( j = 4; j--; ) {
                        corner = corners[j];
                        isBottom = corner.charAt( 0 ) === 'b';
                        isRight = corner.charAt( 1 ) === 'r';
                        shape = getShadowShape( i, corner, xOff, yOff, color, blur, path );
                        fill = shape.fill;
                        fill['focusposition'] = ( isRight ? 1 - focusX : focusX ) + ',' +
                                                ( isBottom ? 1 - focusY : focusY );
                        fill['focussize'] = '0,0';

                        // Clip to show only the appropriate quadrant. Add 1px to the top/left clip values
                        // in IE8 to prevent a bug where IE8 displays one pixel outside the clip region.
                        shape.style.clip = 'rect(' + ( ( isBottom ? totalH / 2 : 0 ) + clipAdjust ) + 'px,' +
                                                     ( isRight ? totalW : totalW / 2 ) + 'px,' +
                                                     ( isBottom ? totalH : totalH / 2 ) + 'px,' +
                                                     ( ( isRight ? totalW / 2 : 0 ) + clipAdjust ) + 'px)';
                    }
                } else {
                    // TODO delete old quadrant shapes if resizing expands past the barrier
                    shape = getShadowShape( i, '', xOff, yOff, color, blur, path );
                    fill = shape.fill;
                    fill['focusposition'] = focusX + ',' + focusY;
                    fill['focussize'] = ( 1 - focusX * 2 ) + ',' + ( 1 - focusY * 2 );
                }
            } else {
                shape = getShadowShape( i, '', xOff, yOff, color, blur, path );
                alpha = color.alpha();
                if( alpha < 1 ) {
                    // shape.style.filter = 'alpha(opacity=' + ( alpha * 100 ) + ')';
                    // ss.filter = 'progid:DXImageTransform.Microsoft.BasicImage(opacity=' + ( alpha  ) + ')';
                    shape.fill.opacity = alpha;
                }
            }
        }
    }

} );
/**
 * Renderer for re-rendering img elements using VML. Kicks in if the img has
 * a border-radius applied, or if the -pie-png-fix flag is set.
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 * @param {PIE.RootRenderer} parent
 */
PIE.ImgRenderer = PIE.RendererBase.newRenderer( {

    boxZIndex: 6,
    boxName: 'imgEl',

    needsUpdate: function() {
        var si = this.styleInfos;
        return this.targetElement.src !== this._lastSrc || si.borderRadiusInfo.changed();
    },

    isActive: function() {
        var si = this.styleInfos;
        return si.borderRadiusInfo.isActive() || si.backgroundInfo.isPngFix();
    },

    draw: function() {
        this._lastSrc = src;
        this.hideActualImg();

        var shape = this.getShape( 'img', 'fill', this.getBox() ),
            fill = shape.fill,
            bounds = this.boundsInfo.getBounds(),
            w = bounds.w,
            h = bounds.h,
            borderProps = this.styleInfos.borderInfo.getProps(),
            borderWidths = borderProps && borderProps.widths,
            el = this.targetElement,
            src = el.src,
            round = Math.round,
            cs = el.currentStyle,
            getLength = PIE.getLength,
            s, zero;

        // In IE6, the BorderRenderer will have hidden the border by moving the border-width to
        // the padding; therefore we want to pretend the borders have no width so they aren't doubled
        // when adding in the current padding value below.
        if( !borderWidths || PIE.ieVersion < 7 ) {
            zero = PIE.getLength( '0' );
            borderWidths = { 't': zero, 'r': zero, 'b': zero, 'l': zero };
        }

        shape.stroked = false;
        fill.type = 'frame';
        fill.src = src;
        fill.position = (w ? 0.5 / w : 0) + ',' + (h ? 0.5 / h : 0);
        shape.coordsize = w * 2 + ',' + h * 2;
        shape.coordorigin = '1,1';
        shape.path = this.getBoxPath( {
            t: round( borderWidths['t'].pixels( el ) + getLength( cs.paddingTop ).pixels( el ) ),
            r: round( borderWidths['r'].pixels( el ) + getLength( cs.paddingRight ).pixels( el ) ),
            b: round( borderWidths['b'].pixels( el ) + getLength( cs.paddingBottom ).pixels( el ) ),
            l: round( borderWidths['l'].pixels( el ) + getLength( cs.paddingLeft ).pixels( el ) )
        }, 2 );
        s = shape.style;
        s.width = w;
        s.height = h;
    },

    hideActualImg: function() {
        this.targetElement.runtimeStyle.filter = 'alpha(opacity=0)';
    },

    destroy: function() {
        PIE.RendererBase.destroy.call( this );
        this.targetElement.runtimeStyle.filter = '';
    }

} );
/**
 * Root renderer for IE9; manages the rendering layers in the element's background
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 */
PIE.IE9RootRenderer = PIE.RendererBase.newRenderer( {

    updatePos: PIE.emptyFn,
    updateSize: PIE.emptyFn,
    updateVisibility: PIE.emptyFn,
    updateProps: PIE.emptyFn,

    outerCommasRE: /^,+|,+$/g,
    innerCommasRE: /,+/g,

    setBackgroundLayer: function(zIndex, bg) {
        var me = this,
            bgLayers = me._bgLayers || ( me._bgLayers = [] ),
            undef;
        bgLayers[zIndex] = bg || undef;
    },

    finishUpdate: function() {
        var me = this,
            bgLayers = me._bgLayers,
            bg;
        if( bgLayers && ( bg = bgLayers.join( ',' ).replace( me.outerCommasRE, '' ).replace( me.innerCommasRE, ',' ) ) !== me._lastBg ) {
            me._lastBg = me.targetElement.runtimeStyle.background = bg;
        }
    },

    destroy: function() {
        this.targetElement.runtimeStyle.background = '';
        delete this._bgLayers;
    }

} );
/**
 * Renderer for element backgrounds, specific for IE9. Only handles translating CSS3 gradients
 * to an equivalent SVG data URI.
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 */
PIE.IE9BackgroundRenderer = PIE.RendererBase.newRenderer( {

    bgLayerZIndex: 1,

    needsUpdate: function() {
        var si = this.styleInfos;
        return si.backgroundInfo.changed();
    },

    isActive: function() {
        var si = this.styleInfos;
        return si.backgroundInfo.isActive() || si.borderImageInfo.isActive();
    },

    draw: function() {
        var me = this,
            props = me.styleInfos.backgroundInfo.getProps(),
            bg, images, i = 0, img, bgAreaSize, bgSize;

        if ( props ) {
            bg = [];

            images = props.bgImages;
            if ( images ) {
                while( img = images[ i++ ] ) {
                    if (img.imgType === 'linear-gradient' ) {
                        bgAreaSize = me.getBgAreaSize( img.bgOrigin );
                        bgSize = ( img.bgSize || PIE.BgSize.DEFAULT ).pixels(
                            me.targetElement, bgAreaSize.w, bgAreaSize.h, bgAreaSize.w, bgAreaSize.h
                        ),
                        bg.push(
                            'url(data:image/svg+xml,' + escape( me.getGradientSvg( img, bgSize.w, bgSize.h ) ) + ') ' +
                            me.bgPositionToString( img.bgPosition ) + ' / ' + bgSize.w + 'px ' + bgSize.h + 'px ' +
                            ( img.bgAttachment || '' ) + ' ' + ( img.bgOrigin || '' ) + ' ' + ( img.bgClip || '' )
                        );
                    } else {
                        bg.push( img.origString );
                    }
                }
            }

            if ( props.color ) {
                bg.push( props.color.val );
            }

            me.parent.setBackgroundLayer(me.bgLayerZIndex, bg.join(','));
        }
    },

    bgPositionToString: function( bgPosition ) {
        return bgPosition ? bgPosition.tokens.map(function(token) {
            return token.tokenValue;
        }).join(' ') : '0 0';
    },

    getBgAreaSize: function( bgOrigin ) {
        var me = this,
            el = me.targetElement,
            bounds = me.boundsInfo.getBounds(),
            elW = bounds.w,
            elH = bounds.h,
            w = elW,
            h = elH,
            borders, getLength, cs;

        if( bgOrigin !== 'border-box' ) {
            borders = me.styleInfos.borderInfo.getProps();
            if( borders && ( borders = borders.widths ) ) {
                w -= borders[ 'l' ].pixels( el ) + borders[ 'l' ].pixels( el );
                h -= borders[ 't' ].pixels( el ) + borders[ 'b' ].pixels( el );
            }
        }

        if ( bgOrigin === 'content-box' ) {
            getLength = PIE.getLength;
            cs = el.currentStyle;
            w -= getLength( cs.paddingLeft ).pixels( el ) + getLength( cs.paddingRight ).pixels( el );
            h -= getLength( cs.paddingTop ).pixels( el ) + getLength( cs.paddingBottom ).pixels( el );
        }

        return { w: w, h: h };
    },

    getGradientSvg: function( info, bgWidth, bgHeight ) {
        var el = this.targetElement,
            stopsInfo = info.stops,
            stopCount = stopsInfo.length,
            metrics = PIE.GradientUtil.getGradientMetrics( el, bgWidth, bgHeight, info ),
            startX = metrics.startX,
            startY = metrics.startY,
            endX = metrics.endX,
            endY = metrics.endY,
            lineLength = metrics.lineLength,
            stopPx,
            i, j, before, after,
            svg;

        // Find the pixel offsets along the CSS3 gradient-line for each stop.
        stopPx = [];
        for( i = 0; i < stopCount; i++ ) {
            stopPx.push( stopsInfo[i].offset ? stopsInfo[i].offset.pixels( el, lineLength ) :
                         i === 0 ? 0 : i === stopCount - 1 ? lineLength : null );
        }
        // Fill in gaps with evenly-spaced offsets
        for( i = 1; i < stopCount; i++ ) {
            if( stopPx[ i ] === null ) {
                before = stopPx[ i - 1 ];
                j = i;
                do {
                    after = stopPx[ ++j ];
                } while( after === null );
                stopPx[ i ] = before + ( after - before ) / ( j - i + 1 );
            }
        }

        svg = [
            '<svg width="' + bgWidth + '" height="' + bgHeight + '" xmlns="http://www.w3.org/2000/svg">' +
                '<defs>' +
                    '<linearGradient id="g" gradientUnits="userSpaceOnUse"' +
                    ' x1="' + ( startX / bgWidth * 100 ) + '%" y1="' + ( startY / bgHeight * 100 ) + '%" x2="' + ( endX / bgWidth * 100 ) + '%" y2="' + ( endY / bgHeight * 100 ) + '%">'
        ];

        // Convert to percentage along the SVG gradient line and add to the stops list
        for( i = 0; i < stopCount; i++ ) {
            svg.push(
                '<stop offset="' + ( stopPx[ i ] / lineLength ) +
                    '" stop-color="' + stopsInfo[i].color.colorValue( el ) +
                    '" stop-opacity="' + stopsInfo[i].color.alpha() + '"/>'
            );
        }

        svg.push(
                    '</linearGradient>' +
                '</defs>' +
                '<rect width="100%" height="100%" fill="url(#g)"/>' +
            '</svg>'
        );

        return svg.join( '' );
    },

    destroy: function() {
        this.parent.setBackgroundLayer( this.bgLayerZIndex );
    }

} );
/**
 * Renderer for border-image
 * @constructor
 * @param {Element} el The target element
 * @param {Object} styleInfos The StyleInfo objects
 * @param {PIE.RootRenderer} parent
 */
PIE.IE9BorderImageRenderer = PIE.RendererBase.newRenderer( {

    REPEAT: 'repeat',
    STRETCH: 'stretch',
    ROUND: 'round',

    bgLayerZIndex: 0,

    needsUpdate: function() {
        return this.styleInfos.borderImageInfo.changed();
    },

    isActive: function() {
        return this.styleInfos.borderImageInfo.isActive();
    },

    draw: function() {
        var me = this,
            props = me.styleInfos.borderImageInfo.getProps(),
            borderProps = me.styleInfos.borderInfo.getProps(),
            bounds = me.boundsInfo.getBounds(),
            repeat = props.repeat,
            repeatH = repeat.h,
            repeatV = repeat.v,
            el = me.targetElement,
            isAsync = 0;

        PIE.Util.withImageSize( props.src, function( imgSize ) {
            var elW = bounds.w,
                elH = bounds.h,
                imgW = imgSize.w,
                imgH = imgSize.h,

                // The image cannot be referenced as a URL directly in the SVG because IE9 throws a strange
                // security exception (perhaps due to cross-origin policy within data URIs?) Therefore we
                // work around this by converting the image data into a data URI itself using a transient
                // canvas. This unfortunately requires the border-image src to be within the same domain,
                // which isn't a limitation in true border-image, so we need to try and find a better fix.
                imgSrc = me.imageToDataURI( props.src, imgW, imgH ),

                REPEAT = me.REPEAT,
                STRETCH = me.STRETCH,
                ROUND = me.ROUND,
                ceil = Math.ceil,

                zero = PIE.getLength( '0' ),
                widths = props.widths || ( borderProps ? borderProps.widths : { 't': zero, 'r': zero, 'b': zero, 'l': zero } ),
                widthT = widths['t'].pixels( el ),
                widthR = widths['r'].pixels( el ),
                widthB = widths['b'].pixels( el ),
                widthL = widths['l'].pixels( el ),
                slices = props.slice,
                sliceT = slices['t'].pixels( el ),
                sliceR = slices['r'].pixels( el ),
                sliceB = slices['b'].pixels( el ),
                sliceL = slices['l'].pixels( el ),
                centerW = elW - widthL - widthR,
                middleH = elH - widthT - widthB,
                imgCenterW = imgW - sliceL - sliceR,
                imgMiddleH = imgH - sliceT - sliceB,

                // Determine the size of each tile - 'round' is handled below
                tileSizeT = repeatH === STRETCH ? centerW : imgCenterW * widthT / sliceT,
                tileSizeR = repeatV === STRETCH ? middleH : imgMiddleH * widthR / sliceR,
                tileSizeB = repeatH === STRETCH ? centerW : imgCenterW * widthB / sliceB,
                tileSizeL = repeatV === STRETCH ? middleH : imgMiddleH * widthL / sliceL,

                svg,
                patterns = [],
                rects = [],
                i = 0;

            // For 'round', subtract from each tile's size enough so that they fill the space a whole number of times
            if (repeatH === ROUND) {
                tileSizeT -= (tileSizeT - (centerW % tileSizeT || tileSizeT)) / ceil(centerW / tileSizeT);
                tileSizeB -= (tileSizeB - (centerW % tileSizeB || tileSizeB)) / ceil(centerW / tileSizeB);
            }
            if (repeatV === ROUND) {
                tileSizeR -= (tileSizeR - (middleH % tileSizeR || tileSizeR)) / ceil(middleH / tileSizeR);
                tileSizeL -= (tileSizeL - (middleH % tileSizeL || tileSizeL)) / ceil(middleH / tileSizeL);
            }


            // Build the SVG for the border-image rendering. Add each piece as a pattern, which is then stretched
            // or repeated as the fill of a rect of appropriate size.
            svg = [
                '<svg width="' + elW + '" height="' + elH + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">'
            ];

            function addImage( x, y, w, h, cropX, cropY, cropW, cropH, tileW, tileH ) {
                patterns.push(
                    '<pattern patternUnits="userSpaceOnUse" id="pattern' + i + '" ' +
                            'x="' + (repeatH === REPEAT ? x + w / 2 - tileW / 2 : x) + '" ' +
                            'y="' + (repeatV === REPEAT ? y + h / 2 - tileH / 2 : y) + '" ' +
                            'width="' + tileW + '" height="' + tileH + '">' +
                        '<svg width="' + tileW + '" height="' + tileH + '" viewBox="' + cropX + ' ' + cropY + ' ' + cropW + ' ' + cropH + '" preserveAspectRatio="none">' +
                            '<image xlink:href="' + imgSrc + '" x="0" y="0" width="' + imgW + '" height="' + imgH + '" />' +
                        '</svg>' +
                    '</pattern>'
                );
                rects.push(
                    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#pattern' + i + ')" />'
                );
                i++;
            }
            addImage( 0, 0, widthL, widthT, 0, 0, sliceL, sliceT, widthL, widthT ); // top left
            addImage( widthL, 0, centerW, widthT, sliceL, 0, imgCenterW, sliceT, tileSizeT, widthT ); // top center
            addImage( elW - widthR, 0, widthR, widthT, imgW - sliceR, 0, sliceR, sliceT, widthR, widthT ); // top right
            addImage( 0, widthT, widthL, middleH, 0, sliceT, sliceL, imgMiddleH, widthL, tileSizeL ); // middle left
            if ( props.fill ) { // center fill
                addImage( widthL, widthT, centerW, middleH, sliceL, sliceT, imgCenterW, imgMiddleH, 
                          tileSizeT || tileSizeB || imgCenterW, tileSizeL || tileSizeR || imgMiddleH );
            }
            addImage( elW - widthR, widthT, widthR, middleH, imgW - sliceR, sliceT, sliceR, imgMiddleH, widthR, tileSizeR ); // middle right
            addImage( 0, elH - widthB, widthL, widthB, 0, imgH - sliceB, sliceL, sliceB, widthL, widthB ); // bottom left
            addImage( widthL, elH - widthB, centerW, widthB, sliceL, imgH - sliceB, imgCenterW, sliceB, tileSizeB, widthB ); // bottom center
            addImage( elW - widthR, elH - widthB, widthR, widthB, imgW - sliceR, imgH - sliceB, sliceR, sliceB, widthR, widthB ); // bottom right

            svg.push(
                    '<defs>' +
                        patterns.join('\n') +
                    '</defs>' +
                    rects.join('\n') +
                '</svg>'
            );

            me.parent.setBackgroundLayer( me.bgLayerZIndex, 'url(data:image/svg+xml,' + escape( svg.join( '' ) ) + ') no-repeat border-box border-box' );

            // If the border-image's src wasn't immediately available, the SVG for its background layer
            // will have been created asynchronously after the main element's update has finished; we'll
            // therefore need to force the root renderer to sync to the final background once finished.
            if( isAsync ) {
                me.parent.finishUpdate();
            }
        }, me );

        isAsync = 1;
    },

    /**
     * Convert a given image to a data URI
     */
    imageToDataURI: (function() {
        var uris = {};
        return function( src, width, height ) {
            var uri = uris[ src ],
                image, canvas;
            if ( !uri ) {
                image = new Image();
                canvas = doc.createElement( 'canvas' );
                image.src = src;
                canvas.width = width;
                canvas.height = height;
                canvas.getContext( '2d' ).drawImage( image, 0, 0 );
                uri = uris[ src ] = canvas.toDataURL();
            }
            return uri;
        }
    })(),

    prepareUpdate: PIE.BorderImageRenderer.prototype.prepareUpdate,

    destroy: function() {
        var me = this,
            rs = me.targetElement.runtimeStyle;
        me.parent.setBackgroundLayer( me.bgLayerZIndex );
        rs.borderColor = rs.borderStyle = rs.borderWidth = '';
    }

} );

PIE.Element = (function() {

    var wrappers = {},
        lazyInitCssProp = PIE.CSS_PREFIX + 'lazy-init',
        pollCssProp = PIE.CSS_PREFIX + 'poll',
        trackActiveCssProp = PIE.CSS_PREFIX + 'track-active',
        trackHoverCssProp = PIE.CSS_PREFIX + 'track-hover',
        hoverClass = PIE.CLASS_PREFIX + 'hover',
        activeClass = PIE.CLASS_PREFIX + 'active',
        focusClass = PIE.CLASS_PREFIX + 'focus',
        firstChildClass = PIE.CLASS_PREFIX + 'first-child',
        ignorePropertyNames = { 'background':1, 'bgColor':1, 'display': 1 },
        classNameRegExes = {},
        dummyArray = [];


    function addClass( el, className ) {
        el.className += ' ' + className;
    }

    function removeClass( el, className ) {
        var re = classNameRegExes[ className ] ||
            ( classNameRegExes[ className ] = new RegExp( '\\b' + className + '\\b', 'g' ) );
        el.className = el.className.replace( re, '' );
    }

    function delayAddClass( el, className /*, className2*/ ) {
        var classes = dummyArray.slice.call( arguments, 1 ),
            i = classes.length;
        setTimeout( function() {
            if( el ) {
                while( i-- ) {
                    addClass( el, classes[ i ] );
                }
            }
        }, 0 );
    }

    function delayRemoveClass( el, className /*, className2*/ ) {
        var classes = dummyArray.slice.call( arguments, 1 ),
            i = classes.length;
        setTimeout( function() {
            if( el ) {
                while( i-- ) {
                    removeClass( el, classes[ i ] );
                }
            }
        }, 0 );
    }



    function Element( el ) {
        var renderers,
            rootRenderer,
            boundsInfo = new PIE.BoundsInfo( el ),
            styleInfos,
            styleInfosArr,
            initializing,
            initialized,
            eventsAttached,
            eventListeners = [],
            delayed,
            destroyed,
            poll;

        /**
         * Initialize PIE for this element.
         */
        function init() {
            if( !initialized ) {
                var docEl,
                    bounds,
                    ieDocMode = PIE.ieDocMode,
                    cs = el.currentStyle,
                    lazy = cs.getAttribute( lazyInitCssProp ) === 'true',
                    trackActive = cs.getAttribute( trackActiveCssProp ) !== 'false',
                    trackHover = cs.getAttribute( trackHoverCssProp ) !== 'false',
                    childRenderers;

                // Polling for size/position changes: default to on in IE8, off otherwise, overridable by -pie-poll
                poll = cs.getAttribute( pollCssProp );
                poll = ieDocMode > 7 ? poll !== 'false' : poll === 'true';

                // Force layout so move/resize events will fire. Set this as soon as possible to avoid layout changes
                // after load, but make sure it only gets called the first time through to avoid recursive calls to init().
                if( !initializing ) {
                    initializing = 1;
                    el.runtimeStyle.zoom = 1;
                    initFirstChildPseudoClass();
                }

                boundsInfo.lock();

                // If the -pie-lazy-init:true flag is set, check if the element is outside the viewport and if so, delay initialization
                if( lazy && ( bounds = boundsInfo.getBounds() ) && ( docEl = doc.documentElement || doc.body ) &&
                        ( bounds.y > docEl.clientHeight || bounds.x > docEl.clientWidth || bounds.y + bounds.h < 0 || bounds.x + bounds.w < 0 ) ) {
                    if( !delayed ) {
                        delayed = 1;
                        PIE.OnScroll.observe( init );
                    }
                } else {
                    initialized = 1;
                    delayed = initializing = 0;
                    PIE.OnScroll.unobserve( init );

                    // Create the style infos and renderers
                    if ( ieDocMode === 9 ) {
                        styleInfos = {
                            backgroundInfo: new PIE.BackgroundStyleInfo( el ),
                            borderImageInfo: new PIE.BorderImageStyleInfo( el ),
                            borderInfo: new PIE.BorderStyleInfo( el )
                        };
                        styleInfosArr = [
                            styleInfos.backgroundInfo,
                            styleInfos.borderImageInfo
                        ];
                        rootRenderer = new PIE.IE9RootRenderer( el, boundsInfo, styleInfos );
                        childRenderers = [
                            new PIE.IE9BackgroundRenderer( el, boundsInfo, styleInfos, rootRenderer ),
                            new PIE.IE9BorderImageRenderer( el, boundsInfo, styleInfos, rootRenderer )
                        ];
                    } else {

                        styleInfos = {
                            backgroundInfo: new PIE.BackgroundStyleInfo( el ),
                            borderInfo: new PIE.BorderStyleInfo( el ),
                            borderImageInfo: new PIE.BorderImageStyleInfo( el ),
                            borderRadiusInfo: new PIE.BorderRadiusStyleInfo( el ),
                            boxShadowInfo: new PIE.BoxShadowStyleInfo( el ),
                            visibilityInfo: new PIE.VisibilityStyleInfo( el )
                        };
                        styleInfosArr = [
                            styleInfos.backgroundInfo,
                            styleInfos.borderInfo,
                            styleInfos.borderImageInfo,
                            styleInfos.borderRadiusInfo,
                            styleInfos.boxShadowInfo,
                            styleInfos.visibilityInfo
                        ];
                        rootRenderer = new PIE.RootRenderer( el, boundsInfo, styleInfos );
                        childRenderers = [
                            new PIE.BoxShadowOutsetRenderer( el, boundsInfo, styleInfos, rootRenderer ),
                            new PIE.BackgroundRenderer( el, boundsInfo, styleInfos, rootRenderer ),
                            //new PIE.BoxShadowInsetRenderer( el, boundsInfo, styleInfos, rootRenderer ),
                            new PIE.BorderRenderer( el, boundsInfo, styleInfos, rootRenderer ),
                            new PIE.BorderImageRenderer( el, boundsInfo, styleInfos, rootRenderer )
                        ];
                        if( el.tagName === 'IMG' ) {
                            childRenderers.push( new PIE.ImgRenderer( el, boundsInfo, styleInfos, rootRenderer ) );
                        }
                        rootRenderer.childRenderers = childRenderers; // circular reference, can't pass in constructor; TODO is there a cleaner way?
                    }
                    renderers = [ rootRenderer ].concat( childRenderers );

                    // Add property change listeners to ancestors if requested
                    initAncestorEventListeners();

                    // Add to list of polled elements in IE8
                    if( poll ) {
                        PIE.Heartbeat.observe( update );
                        PIE.Heartbeat.run();
                    }

                    // Trigger rendering
                    update( 1 );
                }

                if( !eventsAttached ) {
                    eventsAttached = 1;
                    if( ieDocMode < 9 ) {
                        addListener( el, 'onmove', handleMoveOrResize );
                    }
                    addListener( el, 'onresize', handleMoveOrResize );
                    addListener( el, 'onpropertychange', propChanged );
                    if( trackHover ) {
                        addListener( el, 'onmouseenter', mouseEntered );
                    }
                    if( trackHover || trackActive ) {
                        addListener( el, 'onmouseleave', mouseLeft );
                    }
                    if( trackActive ) {
                        addListener( el, 'onmousedown', mousePressed );
                    }
                    if( el.tagName in PIE.focusableElements ) {
                        addListener( el, 'onfocus', focused );
                        addListener( el, 'onblur', blurred );
                    }
                    PIE.OnResize.observe( handleMoveOrResize );

                    PIE.OnUnload.observe( removeEventListeners );
                }

                boundsInfo.unlock();
            }
        }




        /**
         * Event handler for onmove and onresize events. Invokes update() only if the element's
         * bounds have previously been calculated, to prevent multiple runs during page load when
         * the element has no initial CSS3 properties.
         */
        function handleMoveOrResize() {
            if( boundsInfo && boundsInfo.hasBeenQueried() ) {
                update();
            }
        }


        /**
         * Update position and/or size as necessary. Both move and resize events call
         * this rather than the updatePos/Size functions because sometimes, particularly
         * during page load, one will fire but the other won't.
         */
        function update( force ) {
            if( !destroyed ) {
                if( initialized ) {
                    var i, len = renderers.length;

                    lockAll();
                    for( i = 0; i < len; i++ ) {
                        renderers[i].prepareUpdate();
                    }
                    if( force || boundsInfo.positionChanged() ) {
                        /* TODO just using getBoundingClientRect (used internally by BoundsInfo) for detecting
                           position changes may not always be accurate; it's possible that
                           an element will actually move relative to its positioning parent, but its position
                           relative to the viewport will stay the same. Need to come up with a better way to
                           track movement. The most accurate would be the same logic used in RootRenderer.updatePos()
                           but that is a more expensive operation since it does some DOM walking, and we want this
                           check to be as fast as possible. */
                        for( i = 0; i < len; i++ ) {
                            renderers[i].updatePos();
                        }
                    }
                    if( force || boundsInfo.sizeChanged() ) {
                        for( i = 0; i < len; i++ ) {
                            renderers[i].updateSize();
                        }
                    }
                    rootRenderer.finishUpdate();
                    unlockAll();
                }
                else if( !initializing ) {
                    init();
                }
            }
        }

        /**
         * Handle property changes to trigger update when appropriate.
         */
        function propChanged() {
            var i, len = renderers.length,
                renderer,
                e = event;

            // Some elements like <table> fire onpropertychange events for old-school background properties
            // ('background', 'bgColor') when runtimeStyle background properties are changed, which
            // results in an infinite loop; therefore we filter out those property names. Also, 'display'
            // is ignored because size calculations don't work correctly immediately when its onpropertychange
            // event fires, and because it will trigger an onresize event anyway.
            if( !destroyed && !( e && e.propertyName in ignorePropertyNames ) ) {
                if( initialized ) {
                    lockAll();
                    for( i = 0; i < len; i++ ) {
                        renderers[i].prepareUpdate();
                    }
                    for( i = 0; i < len; i++ ) {
                        renderer = renderers[i];
                        // Make sure position is synced if the element hasn't already been rendered.
                        // TODO this feels sloppy - look into merging propChanged and update functions
                        if( !renderer.isPositioned ) {
                            renderer.updatePos();
                        }
                        if( renderer.needsUpdate() ) {
                            renderer.updateProps();
                        }
                    }
                    rootRenderer.finishUpdate();
                    unlockAll();
                }
                else if( !initializing ) {
                    init();
                }
            }
        }


        /**
         * Handle mouseenter events. Adds a custom class to the element to allow IE6 to add
         * hover styles to non-link elements, and to trigger a propertychange update.
         */
        function mouseEntered() {
            //must delay this because the mouseenter event fires before the :hover styles are added.
            delayAddClass( el, hoverClass );
        }

        /**
         * Handle mouseleave events
         */
        function mouseLeft() {
            //must delay this because the mouseleave event fires before the :hover styles are removed.
            delayRemoveClass( el, hoverClass, activeClass );
        }

        /**
         * Handle mousedown events. Adds a custom class to the element to allow IE6 to add
         * active styles to non-link elements, and to trigger a propertychange update.
         */
        function mousePressed() {
            //must delay this because the mousedown event fires before the :active styles are added.
            delayAddClass( el, activeClass );

            // listen for mouseups on the document; can't just be on the element because the user might
            // have dragged out of the element while the mouse button was held down
            PIE.OnMouseup.observe( mouseReleased );
        }

        /**
         * Handle mouseup events
         */
        function mouseReleased() {
            //must delay this because the mouseup event fires before the :active styles are removed.
            delayRemoveClass( el, activeClass );

            PIE.OnMouseup.unobserve( mouseReleased );
        }

        /**
         * Handle focus events. Adds a custom class to the element to trigger a propertychange update.
         */
        function focused() {
            //must delay this because the focus event fires before the :focus styles are added.
            delayAddClass( el, focusClass );
        }

        /**
         * Handle blur events
         */
        function blurred() {
            //must delay this because the blur event fires before the :focus styles are removed.
            delayRemoveClass( el, focusClass );
        }


        /**
         * Handle property changes on ancestors of the element; see initAncestorEventListeners()
         * which adds these listeners as requested with the -pie-watch-ancestors CSS property.
         */
        function ancestorPropChanged() {
            var name = event.propertyName;
            if( name === 'className' || name === 'id' ) {
                propChanged();
            }
        }

        function lockAll() {
            boundsInfo.lock();
            for( var i = styleInfosArr.length; i--; ) {
                styleInfosArr[i].lock();
            }
        }

        function unlockAll() {
            for( var i = styleInfosArr.length; i--; ) {
                styleInfosArr[i].unlock();
            }
            boundsInfo.unlock();
        }


        function addListener( targetEl, type, handler ) {
            targetEl.attachEvent( type, handler );
            eventListeners.push( [ targetEl, type, handler ] );
        }

        /**
         * Remove all event listeners from the element and any monitored ancestors.
         */
        function removeEventListeners() {
            if (eventsAttached) {
                var i = eventListeners.length,
                    listener;

                while( i-- ) {
                    listener = eventListeners[ i ];
                    listener[ 0 ].detachEvent( listener[ 1 ], listener[ 2 ] );
                }

                PIE.OnUnload.unobserve( removeEventListeners );
                eventsAttached = 0;
                eventListeners = [];
            }
        }


        /**
         * Clean everything up when the behavior is removed from the element, or the element
         * is manually destroyed.
         */
        function destroy() {
            if( !destroyed ) {
                var i, len;

                removeEventListeners();

                destroyed = 1;

                // destroy any active renderers
                if( renderers ) {
                    for( i = 0, len = renderers.length; i < len; i++ ) {
                        renderers[i].finalized = 1;
                        renderers[i].destroy();
                    }
                }

                // Remove from list of polled elements in IE8
                if( poll ) {
                    PIE.Heartbeat.unobserve( update );
                }
                // Stop onresize listening
                PIE.OnResize.unobserve( update );

                // Kill references
                renderers = boundsInfo = styleInfos = styleInfosArr = el = null;
            }
        }


        /**
         * If requested via the custom -pie-watch-ancestors CSS property, add onpropertychange and
         * other event listeners to ancestor(s) of the element so we can pick up style changes
         * based on CSS rules using descendant selectors.
         */
        function initAncestorEventListeners() {
            var watch = el.currentStyle.getAttribute( PIE.CSS_PREFIX + 'watch-ancestors' ),
                i, a;
            if( watch ) {
                watch = parseInt( watch, 10 );
                i = 0;
                a = el.parentNode;
                while( a && ( watch === 'NaN' || i++ < watch ) ) {
                    addListener( a, 'onpropertychange', ancestorPropChanged );
                    addListener( a, 'onmouseenter', mouseEntered );
                    addListener( a, 'onmouseleave', mouseLeft );
                    addListener( a, 'onmousedown', mousePressed );
                    if( a.tagName in PIE.focusableElements ) {
                        addListener( a, 'onfocus', focused );
                        addListener( a, 'onblur', blurred );
                    }
                    a = a.parentNode;
                }
            }
        }


        /**
         * If the target element is a first child, add a pie_first-child class to it. This allows using
         * the added class as a workaround for the fact that PIE's rendering element breaks the :first-child
         * pseudo-class selector.
         */
        function initFirstChildPseudoClass() {
            var tmpEl = el,
                isFirst = 1;
            while( tmpEl = tmpEl.previousSibling ) {
                if( tmpEl.nodeType === 1 ) {
                    isFirst = 0;
                    break;
                }
            }
            if( isFirst ) {
                addClass( el, firstChildClass );
            }
        }


        // These methods are all already bound to this instance so there's no need to wrap them
        // in a closure to maintain the 'this' scope object when calling them.
        this.init = init;
        this.update = update;
        this.destroy = destroy;
        this.el = el;
    }

    Element.getInstance = function( el ) {
        var id = PIE.Util.getUID( el );
        return wrappers[ id ] || ( wrappers[ id ] = new Element( el ) );
    };

    Element.destroy = function( el ) {
        var id = PIE.Util.getUID( el ),
            wrapper = wrappers[ id ];
        if( wrapper ) {
            wrapper.destroy();
            delete wrappers[ id ];
        }
    };

    Element.destroyAll = function() {
        var els = [], wrapper;
        if( wrappers ) {
            for( var w in wrappers ) {
                if( wrappers.hasOwnProperty( w ) ) {
                    wrapper = wrappers[ w ];
                    els.push( wrapper.el );
                    wrapper.destroy();
                }
            }
            wrappers = {};
        }
        return els;
    };

    return Element;
})();

/*
 * This file exposes the public API for invoking PIE.
 */


/**
 * @property supportsVML
 * True if the current IE browser environment has a functioning VML engine. Should be true
 * in most IEs, but in rare cases may be false. If false, PIE will exit immediately when
 * attached to an element; this property may be used for debugging or by external scripts
 * to perform some special action when VML support is absent.
 * @type {boolean}
 */
PIE[ 'supportsVML' ] = PIE.supportsVML;


/**
 * Programatically attach PIE to a single element.
 * @param {Element} el
 */
PIE[ 'attach' ] = function( el ) {
    if (PIE.ieDocMode < 10 && PIE.supportsVML) {
        PIE.Element.getInstance( el ).init();
    }
};


/**
 * Programatically detach PIE from a single element.
 * @param {Element} el
 */
PIE[ 'detach' ] = function( el ) {
    PIE.Element.destroy( el );
};


} // if( !PIE )
})();