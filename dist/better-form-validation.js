/**
 * @file better-form-validation.js
 * @version 1.1.1 2013-11-12T18:34:14
 * @overview Form validation polyfill for better-dom
 * @copyright Maksim Chemerisuk 2013
 * @license MIT
 * @see https://github.com/chemerisuk/better-form-validation
 */
(function(DOM) {
    "use strict";

    var reNumber = /^-?[0-9]*(\.[0-9]+)?$/,
        reEmail = /^([a-z0-9_\.\-\+]+)@([\da-z\.\-]+)\.([a-z\.]{2,6})$/i,
        reUrl = /^(https?:\/\/)?[\da-z\.\-]+\.[a-z\.]{2,6}[#&+_\?\/\w \.\-=]*$/i,
        predefinedPatterns = {number: reNumber, email: reEmail, url: reUrl},
        isArray = Array.isArray || function(obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        },
        hasCheckedRadio = function(el) {
            return el.get("name") === this.get("name") && el.get("checked");
        },
        checkCustomValidators = function(el) {
            var errors = [], selector, message;

            for (selector in customValidators) {
                if (el.matches(selector)) {
                    message = customValidators[selector].call(el);

                    if (message) errors.push(message);
                }
            }

            return errors;
        },
        customValidators = {},
        validityTooltip = DOM.create("div.better-form-validation-tooltip").hide(),
        lastCapturedElement;

    DOM.extend("input,textarea,select", {
        constructor: function() {
            this._customErrors = this._validity = [];

            if (this.matches("textarea")) {
                this.on("input", function() {
                    var maxlength = parseFloat(this.get("maxlength")),
                        value = this.get();

                    if (maxlength && value.length > maxlength) {
                        this.set(value.substr(0, maxlength));
                    }

                    this._refreshValidity();
                });
            } else {
                this.on("input", this._refreshValidity);
            }
        },
        _refreshValidity: function() {
            this.setValidity(this._checkValidity(), true);
        },
        _checkValidity: function() {
            var type = this.get("type"),
                value = this.get("value"),
                required = this.matches("[required]"),
                errors = checkCustomValidators(this),
                regexp;

            Array.prototype.push.apply(errors, this._customErrors);

            switch(type) {
            case "image":
            case "submit":
            case "button":
            case "select-one":
            case "select-multiple":
                // only check custom error case
                return errors;

            case "radio":
                if (!required || this.parent("form").findAll("[name]").some(hasCheckedRadio, this)) break;
                /* falls through */
            case "checkbox":
                if (required && !this.get("checked")) errors.push("i18n:value-missing");
                break;

            default:
                if (value) {
                    regexp = predefinedPatterns[type];

                    if (regexp && !regexp.test(value)) {
                        errors.push("i18n:" + type + "-mismatch");
                    }

                    if (type !== "textarea") {
                        regexp = this.get("pattern");

                        if (regexp && !new RegExp("^(?:" + regexp + ")$").test(value)) {
                            errors.push(this.get("title") || "i18n:pattern-mismatch");
                        }
                    }
                } else if (required) {
                    errors.push("i18n:value-missing");
                }
            }

            return errors;
        },
        isValid: function() {
            return !this._validity.length;
        },
        getValidity: function() {
            // return clone of the validity object
            return this._validity.slice(0);
        },
        setValidity: function(errors, /*INTERNAL*/partial) {
            if (!isArray(errors)) {
                throw "Errors should be an array";
            }

            var oldValid = this.isValid();

            this._validity = errors;

            if (!partial) this._customErrors = errors;

            if (!this.isValid() || !oldValid) {
                this.fire("validation:" + (this.isValid() ? "success" : "fail"));
            }

            return this;
        }
    });

    DOM.extend("form", {
        constructor: function() {
            this._validity = {};

            this
                .set("novalidate", "novalidate")
                .on("reset", validityTooltip, "hide")
                .on("submit", function() {
                    this._refreshValidity();

                    return this.isValid();
                });
        },
        _refreshValidity: function() {
            this.setValidity(this._checkValidity(), true);
        },
        _checkValidity: function() {
            return this.findAll("[name]").reduce(function(memo, el) {
                if (el._checkValidity) {
                    var errors = el._checkValidity();

                    if (errors.length) memo[el.get("name")] = errors;
                }

                return memo;
            }, {});
        },
        isValid: function() {
            for (var key in this._validity) {
                if (this._validity[key].length) return false;
            }

            return true;
        },
        getValidity: function() {
            // return clone of the validity object
            return JSON.parse(JSON.stringify(this._validity));
        },
        setValidity: function(errors, /*INTERNAL*/partial) {
            if (typeof errors !== "object") throw "Errors should be an object";

            var oldValid = this.isValid();

            // from right to left to display top elements first
            this.findAll("[name]").reduceRight(function(memo, el) {
                var key = el.get("name"), validity;

                if (key && (validity = errors[key])) {
                    el.setValidity(validity, partial);
                }
            }, 0);

            this._validity = errors;

            if (!this.isValid() || !oldValid) {
                this.fire("validation:" + (this.isValid() ? "success" : "fail"));
            }

            return this;
        }
    });

    validityTooltip.on("click", function() {
        if (lastCapturedElement) lastCapturedElement.fire("select");

        validityTooltip.hide();
    });

    DOM.on({
        "validation:fail": function(target, cancel) {
            if (!cancel && !target.matches("form")) {
                var offset = target.offset(),
                    message = target.getValidity()[0],
                    i18nMessage = !message.indexOf("i18n:");

                validityTooltip
                    .i18n(i18nMessage ? message.substr(5) : "")
                    .set(i18nMessage ? "" : message)
                    .style({ left: offset.left, top: offset.bottom })
                    .show();

                lastCapturedElement = target;
            }
        },
        "validation:success": function(target, cancel) {
            if (!cancel) validityTooltip.hide();
        }
    });

    DOM.ready(function() {
        DOM.find("body").prepend(validityTooltip);
    });

    DOM.registerValidator = function(selector, fn) {
        if (selector in customValidators) {
            throw "Can't register validator for the same selector twice!";
        }

        customValidators[selector] = fn;
    };
}(window.DOM));
