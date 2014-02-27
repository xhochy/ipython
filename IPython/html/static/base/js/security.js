//----------------------------------------------------------------------------
//  Copyright (C) 2014  The IPython Development Team
//
//  Distributed under the terms of the BSD License.  The full license is in
//  the file COPYING, distributed as part of this software.
//----------------------------------------------------------------------------

//============================================================================
// Utilities
//============================================================================
IPython.namespace('IPython.security');

IPython.security = (function (IPython) {
    "use strict";

    var utils = IPython.utils;
    
    var noop = function (x) { return x; };
    
    var cmp_tree = function (a, b) {
        // compare two HTML trees
        // only checks the tag structure is preserved,
        // not any attributes or contents
        if (a.length !== b.length) {
            return false;
        }
        
        for (var i = a.length - 1; i >= 0; i--) {
            if ((a[i].tagName || '').toLowerCase() != (b[i].tagName || '').toLowerCase()) {
                return false;
            }
        }
        var ac = a.children();
        var bc = b.children();
        if (ac.length === 0 && bc.length === 0) {
            return true;
        }
        return cmp_tree(ac, bc);
    };
    
    var caja;
    if (window && window.html) {
        caja = window.html;
        caja.html4 = window.html4;
        caja.sanitizeStylesheet = window.sanitizeStylesheet;
    }
    
    var sanitizeAttribs = function (tagName, attribs, opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger) {
        // wrap sanitizeAttribs into trusting data-attributes
        var ATTRIBS = caja.html4.ATTRIBS;
        for (var i = 0; i < attribs.length; i += 2) {
            var attribName = attribs[i];
            if (attribName.substr(0,5) == 'data-') {
                var attribKey = '*::' + attribName;
                if (!ATTRIBS.hasOwnProperty(attribKey)) {
                    ATTRIBS[attribKey] = 0;
                }
            }
        }
        return caja.sanitizeAttribs(tagName, attribs, opt_naiveUriRewriter, opt_nmTokenPolicy, opt_logger);
    };
    
    var sanitize_css = function (css, tagPolicy) {
        return caja.sanitizeStylesheet(
            window.location.pathname,
            css,
            {
                containerClass: null,
                idSuffix: '',
                tagPolicy: tagPolicy,
                virtualizeAttrName: noop
            },
            noop
        );
    };
    
    var sanitize_stylesheets = function (html, tagPolicy) {
        var h = $("<div/>").append(html);
        var style_tags = h.find("style");
        if (!style_tags.length) {
            // no style tags to sanitize
            return html;
        }
        style_tags.each(function(i, style) {
            style.innerHTML = sanitize_css(style.innerHTML, tagPolicy);
        });
        return h.html();
    };
    
    var sanitize = function (html, allow_css) {
        // sanitize HTML
        // if allow_css is true (default), CSS is sanitized as well.
        // otherwise, CSS elements and attributes are simply removed.
        // returns a struct of
        // {
        //   src: original_html,
        //   sanitized: the_sanitized_html,
        //   _maybe_safe: bool // false if the sanitizer definitely made changes.
        //                        This is an incomplete indication,
        //                        only used to indicate whether further verification is necessary.
        // }
        var html4 = caja.html4;

        if (allow_css === undefined) allow_css = true;
        if (allow_css) {
            // allow sanitization of style tags,
            // not just scrubbing
            html4.ELEMENTS.style &= ~html4.eflags.UNSAFE;
            html4.ATTRIBS.style = html4.atype.STYLE;
        } else {
            // scrub all CSS
            html4.ELEMENTS.style |= html4.eflags.UNSAFE;
            html4.ATTRIBS.style = html4.atype.SCRIPT;
        }
        
        var result = {
            src : html,
            _maybe_safe : true
        };
        var record_messages = function (msg, opts) {
            console.log("HTML Sanitizer", msg, opts);
            result._maybe_safe = false;
        };
        
        var policy = function (tagName, attribs) {
            if (!(html4.ELEMENTS[tagName] & html4.eflags.UNSAFE)) {
                return {
                    'attribs': sanitizeAttribs(tagName, attribs,
                        noop, noop, record_messages)
                    };
            } else {
                record_messages(tagName + " removed", {
                  change: "removed",
                  tagName: tagName
                });
            }
        };
        
        result.sanitized = caja.sanitizeWithPolicy(html, policy);
        
        if (allow_css) {
            // sanitize style tags as stylesheets
            result.sanitized = sanitize_stylesheets(result.sanitized, policy);
        }
        
        return result;
    };
    
    var sanitize_html = function (html) {
        // shorthand for str-to-str conversion, dropping the struct
        return sanitize(html).sanitized;
    };
    
    var is_safe = function (html) {
        // just return bool for whether an HTML string is safe
        // this is not currently used for anything other than tests.
        var result = sanitize(html);
        
        // caja can strip whole elements without logging,
        // so double-check that node structure didn't change
        if (result._maybe_safe) {
            result.safe = cmp_tree($(result.sanitized), $(html));
        } else {
            result.safe = false;
        }
        return result.safe;
    };
    
    return {
        caja: caja,
        is_safe: is_safe,
        sanitize: sanitize,
        sanitize_html: sanitize_html
    };

}(IPython));

