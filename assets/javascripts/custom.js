/**
 * Timeago is a jQuery plugin that makes it easy to support automatically
 * updating fuzzy timestamps (e.g. "4 minutes ago" or "about 1 day ago").
 *
 * @name timeago
 * @version 1.5.1
 * @requires jQuery v1.2.3+
 * @author Ryan McGeary
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://timeago.yarp.com/
 *
 * Copyright (c) 2008-2015, Ryan McGeary (ryan -[at]- mcgeary [*dot*] org)
 */

(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else if (typeof module === 'object' && typeof module.exports === 'object') {
    factory(require('jquery'));
  } else {
    // Browser globals
    factory(jQuery);
  }
}(function ($) {
  $.timeago = function(timestamp) {
    if (timestamp instanceof Date) {
      return inWords(timestamp);
    } else if (typeof timestamp === "string") {
      return inWords($.timeago.parse(timestamp));
    } else if (typeof timestamp === "number") {
      return inWords(new Date(timestamp));
    } else {
      return inWords($.timeago.datetime(timestamp));
    }
  };
  var $t = $.timeago;

  $.extend($.timeago, {
    settings: {
      refreshMillis: 60000,
      allowPast: true,
      allowFuture: false,
      localeTitle: false,
      cutoff: 0,
      autoDispose: true,
      strings: {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        inPast: 'any moment now',
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        wordSeparator: " ",
        numbers: []
      }
    },

    inWords: function(distanceMillis) {
      if (!this.settings.allowPast && ! this.settings.allowFuture) {
          throw 'timeago allowPast and allowFuture settings can not both be set to false.';
      }

      var $l = this.settings.strings;
      var prefix = $l.prefixAgo;
      var suffix = $l.suffixAgo;
      if (this.settings.allowFuture) {
        if (distanceMillis < 0) {
          prefix = $l.prefixFromNow;
          suffix = $l.suffixFromNow;
        }
      }

      if (!this.settings.allowPast && distanceMillis >= 0) {
        return this.settings.strings.inPast;
      }

      var seconds = Math.abs(distanceMillis) / 1000;
      var minutes = seconds / 60;
      var hours = minutes / 60;
      var days = hours / 24;
      var years = days / 365;

      function substitute(stringOrFunction, number) {
        var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
        var value = ($l.numbers && $l.numbers[number]) || number;
        return string.replace(/%d/i, value);
      }

      var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
        seconds < 90 && substitute($l.minute, 1) ||
        minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
        minutes < 90 && substitute($l.hour, 1) ||
        hours < 24 && substitute($l.hours, Math.round(hours)) ||
        hours < 42 && substitute($l.day, 1) ||
        days < 30 && substitute($l.days, Math.round(days)) ||
        days < 45 && substitute($l.month, 1) ||
        days < 365 && substitute($l.months, Math.round(days / 30)) ||
        years < 1.5 && substitute($l.year, 1) ||
        substitute($l.years, Math.round(years));

      var separator = $l.wordSeparator || "";
      if ($l.wordSeparator === undefined) { separator = " "; }
      return $.trim([prefix, words, suffix].join(separator));
    },

    parse: function(iso8601) {
      var s = $.trim(iso8601);
      s = s.replace(/\.\d+/,""); // remove milliseconds
      s = s.replace(/-/,"/").replace(/-/,"/");
      s = s.replace(/T/," ").replace(/Z/," UTC");
      s = s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2"); // -04:00 -> -0400
      s = s.replace(/([\+\-]\d\d)$/," $100"); // +09 -> +0900
      return new Date(s);
    },
    datetime: function(elem) {
      var iso8601 = $t.isTime(elem) ? $(elem).attr("datetime") : $(elem).attr("title");
      return $t.parse(iso8601);
    },
    isTime: function(elem) {
      // jQuery's `is()` doesn't play well with HTML5 in IE
      return $(elem).get(0).tagName.toLowerCase() === "time"; // $(elem).is("time");
    }
  });

  // functions that can be called via $(el).timeago('action')
  // init is default when no action is given
  // functions are called with context of a single element
  var functions = {
    init: function() {
      var refresh_el = $.proxy(refresh, this);
      refresh_el();
      var $s = $t.settings;
      if ($s.refreshMillis > 0) {
        this._timeagoInterval = setInterval(refresh_el, $s.refreshMillis);
      }
    },
    update: function(timestamp) {
      var date = (timestamp instanceof Date) ? timestamp : $t.parse(timestamp);
      $(this).data('timeago', { datetime: date });
      if ($t.settings.localeTitle) $(this).attr("title", date.toLocaleString());
      refresh.apply(this);
    },
    updateFromDOM: function() {
      $(this).data('timeago', { datetime: $t.parse( $t.isTime(this) ? $(this).attr("datetime") : $(this).attr("title") ) });
      refresh.apply(this);
    },
    dispose: function () {
      if (this._timeagoInterval) {
        window.clearInterval(this._timeagoInterval);
        this._timeagoInterval = null;
      }
    }
  };

  $.fn.timeago = function(action, options) {
    var fn = action ? functions[action] : functions.init;
    if (!fn) {
      throw new Error("Unknown function name '"+ action +"' for timeago");
    }
    // each over objects here and call the requested function
    this.each(function() {
      fn.call(this, options);
    });
    return this;
  };

  function refresh() {
    var $s = $t.settings;

    //check if it's still visible
    if ($s.autoDispose && !$.contains(document.documentElement,this)) {
      //stop if it has been removed
      $(this).timeago("dispose");
      return this;
    }

    var data = prepareData(this);

    if (!isNaN(data.datetime)) {
      if ( $s.cutoff == 0 || Math.abs(distance(data.datetime)) < $s.cutoff) {
        $(this).text(inWords(data.datetime));
      }
    }
    return this;
  }

  function prepareData(element) {
    element = $(element);
    if (!element.data("timeago")) {
      element.data("timeago", { datetime: $t.datetime(element) });
      var text = $.trim(element.text());
      if ($t.settings.localeTitle) {
        element.attr("title", element.data('timeago').datetime.toLocaleString());
      } else if (text.length > 0 && !($t.isTime(element) && element.attr("title"))) {
        element.attr("title", text);
      }
    }
    return element.data("timeago");
  }

  function inWords(date) {
    return $t.inWords(distance(date));
  }

  function distance(date) {
    return (new Date().getTime() - date.getTime());
  }

  // fix for IE6 suckage
  document.createElement("abbr");
  document.createElement("time");
}));


   var REGEX_EMAIL = '([a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*@' +
                  '(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)';
      $('#select-professions').selectize({
          valueField: 'profession',
          labelField: 'profession',
          searchField: ['profession'],
        options: [ {profession: 'Abdominal Radiology'},{profession: 'Abdominal Surgery'},{profession: 'Addiction Medicine'},{profession: 'Addiction Psychiatry'},{profession: 'Adolescent Medicine (Family Medicine)'},{profession: 'Adolescent Medicine (Internal Medicine)'},{profession: 'Adolescent Medicine (Pediatrics)'},{profession: 'Adult Cardiothoracic Anesthesiology (Anesthesiology)'},{profession: 'Adult Congenital Heart Disease (Internal Medicine)'},{profession: 'Adult Reconstructive Orthopedics'},{profession: 'Advanced Heart Failure and Transplant Cardiology'},{profession: 'Advanced Surgical Oncology'},{profession: 'erospace Medicine'},{profession: 'Allergy'},{profession: 'Allergy & Immunology'},{profession: 'Anatomic Pathology'},{profession: 'Anatomic/Clinical Pathology'},{profession: 'Anesthesiology'},{profession: 'Blood Banking/Transfusion Medicine'},{profession: 'Brain Injury Medicine (Physical Medicine & Rehabilitation)'},{profession: 'Brain Injury Medicine (Psychiatry & Neurology)'},{profession: 'Cardiothoracic Radiology'},{profession: 'Cardiovascular Disease'},{profession: 'Chemical Pathology'},{profession: 'Child Abuse Pediatrics'},{profession: 'Child and Adolescent Psychiatry'},{profession: 'Child Neurology'},{profession: 'Clinical and Laboratory Dermatological Immunology'},{profession: 'Clinical and Laboratory Immunology (Internal Medicine)'},{profession: 'Clinical and Laboratory Immunology (Pediatrics)'},{profession: 'Clinical Biochemical Genetics'},{profession: 'Clinical Cardiac Electrophysiology'},{profession: 'Clinical Cytogenetics'},{profession: 'CG |Clinical Genetics'},{profession: 'Clinical Informatics (Pathology)'},{profession: 'Clinical Informatics (Preventive Medicine)'},{profession: 'Clinical Laboratory Immunology (Allergy & Immunology)'},{profession: 'Clinical Molecular Genetics'},{profession: 'Clinical Neurophysiology'},{profession: 'Clinical Pathology'},{profession: 'Clinical Pharmacology'},{profession: 'Colon & Rectal Surgery'},{profession: 'Congenital Cardiac Surgery (Thoracic Surgery)'},{profession: 'Cosmetic Surgery'},{profession: 'Craniofacial Surgery'},{profession: 'Critical Care Medicine (Anesthesiology)'},{profession: 'Critical Care Medicine (Emergency Medicine)'},{profession: 'Critical Care Medicine (Internal Medicine)'},{profession: 'Critical Care Medicine (Obstetrics & Gynecology)'},{profession: 'Cytopathology'},{profession: 'Dermatologic Surgery'},{profession: 'Dermatology'},{profession: 'Dermatopathology'},{profession: 'Developmental-Behavioral Pediatrics'},{profession: 'Diabetes'},{profession: 'Diagnostic Radiology'},{profession: 'Emergency Medical Services'},{profession: 'Emergency Medicine'},{profession: 'Emergency Medicine/Family Medicine'},{profession: 'Endocrinology, Diabetes and Metabolism'},{profession: 'Endovascular Surgical Neuroradiology (Neurological Surgery)'},{profession: 'Endovascular Surgical Neuroradiology (Neurology)'},{profession: 'Endovascular Surgical Neuroradiology (Radiology)'},{profession: 'Epidemiology'},{profession: 'Epilepsy'},{profession: 'Facial Plastic Surgery'},{profession: 'Family Medicine'},{profession: 'Family Medicine/Preventive Medicine'},{profession: 'Female Pelvic Medicine & Reconstructive'},{profession: 'Female Pelvic Medicine & Reconstructive'},{profession: 'Foot and Ankle, Orthopedics'},{profession: 'Forensic Pathology'},{profession: 'Forensic Psychiatry'},{profession: 'Gastroenterology'},{profession: 'General Practice'},{profession: 'General Preventive Medicine'},{profession: 'General Surgery'},{profession: 'Geriatric Medicine (Family Medicine)'},{profession: 'Geriatric Medicine (Internal Medicine)'},{profession: 'Geriatric Psychiatry'},{profession: 'Gynecological Oncology'},{profession: 'Gynecology'},{profession: 'Hand Surgery'},{profession: 'Hand Surgery (Orthopedics)'},{profession: 'Hand Surgery (Plastic Surgery)'},{profession: 'Hand Surgery (Surgery)'},{profession: 'Head & Neck Surgery'},{profession: 'Hematology (Internal Medicine)'},{profession: 'Hematology (Pathology)'},{profession: 'Hematology/Oncology'},{profession: 'Hepatology'},{profession: 'Hospice & Palliative Medicine'},{profession: 'Hospice & Palliative Medicine (Anesthesiology)'},{profession: 'Hospice & Palliative Medicine (Emergency Medicine)'},{profession: 'Hospice & Palliative Medicine (Family Medicine)'},{profession: 'Hospice & Palliative Medicine (Internal Medicine)'},{profession: 'Hospice & Palliative Medicine (Obstetrics & Gynecology)'},{profession: 'Hospice & Palliative Medicine (Pediatrics)'},{profession: 'Hospice & Palliative Medicine (Physical Medicine & Rehabilitation)'},{profession: 'Hospice & Palliative Medicine (Psychiatry & Neurology)'},{profession: 'Hospice & Palliative Medicine (Radiology)'},{profession: 'Hospice & Palliative Medicine (Surgery)'},{profession: 'Hospitalist'},{profession: 'Immunology'},{profession: 'Infectious Disease'},{profession: 'Internal Medicine'},{profession: 'Internal Medicine/Anesthesiology'},{profession: 'Internal Medicine/Dermatology'},{profession: 'Internal Medicine/Emergency Medicine'},{profession: 'Internal Medicine/Emergency Medicine Critical Care Medicine'},{profession: 'Internal Medicine/Family Medicine'},{profession: 'Internal Medicine/Medical Genetics'},{profession: 'Internal Medicine/Neurology'},{profession: 'Internal Medicine/Nuclear Medicine'},{profession: 'Internal Medicine/Pediatrics'},{profession: 'Internal Medicine/Physical Medicine & Rehabilitation'},{profession: 'Internal Medicine/Preventive Medicine'},{profession: 'Internal Medicine/Psychiatry'},{profession: 'Interventional Cardiology'},{profession: 'Legal Medicine'},{profession: 'Maternal & Fetal Medicine'},{profession: 'Medical Biochemical Genetics'},{profession: 'Medical Genetics'},{profession: 'Medical Management'},{profession: 'Medical Microbiology'},{profession: 'Medical Oncology'},{profession: 'Medical Physics (Radiology)'},{profession: 'Medical Toxicology (Emergency Medicine)'},{profession: 'Medical Toxicology (Pediatrics)'},{profession: 'Medical Toxicology (Preventive Medicine)'},{profession: 'Molecular Genetic Pathology (Medical Genetics)'},{profession: 'Molecular Genetic Pathology (Pathology)'},{profession: 'Musculoskeletal Oncology'},{profession: 'Musculoskeletal Radiology'},{profession: 'Neonatal-Perinatal Medicine'},{profession: 'Nephrology'},{profession: 'Neurodevelopmental Disabilities (Pediatrics)'},{profession: 'Neurodevelopmental Disabilities (Psychiatry & Neurology)'},{profession: 'Neurological Surgery'},{profession: 'Neurology'},{profession: 'Neurology/DiagnosticRadiology/Neuroradiology'},{profession: 'Neurology/Nuclear Medicine'},{profession: 'Neurology/Physical Medicine & Rehabilitation'},{profession: 'Neuromuscular Medicine (Neurology)'},{profession: 'Neuromuscular Medicine (Physical Medicine & Rehabilitation)'},{profession: 'Neuropathology'},{profession: 'Neuropsychiatry'},{profession: 'Neuroradiology'},{profession: 'Neurotology (Otolaryngology)'},{profession: 'Nuclear Cardiology'},{profession: 'Nuclear Medicine'},{profession: 'Nuclear Radiology'},{profession: 'Nutrition'},{profession: 'Obstetric Anesthesiology'},{profession: 'Obstetrics'},{profession: 'Obstetrics & Gynecology'},{profession: 'Occupational Medicine'},{profession: 'Ophthalmic Plastic and Reconstructive Surgery'},{profession: 'Ophthalmology'},{profession: 'Oral & Maxillofacial Surgery'},{profession: 'Orthopedic Surgery'},{profession: 'Orthopedic Surgery of the Spine'},{profession: 'Orthopedic Trauma'},{profession: 'Osteopathic Manipulative Medicine'},{profession: 'Other (i.e., a specialty other than those appearing above)'},{profession: 'Otolaryngology'},{profession: 'Pain Management'},{profession: 'Pain Medicine'},{profession: 'Pain Medicine (Anesthesiology)'},{profession: 'Pain Medicine (Neurology)'},{profession: 'Pain Medicine (Physical Medicine & Rehabilitation)'},{profession: 'Pain Medicine (Psychiatry)'},{profession: 'Palliative Medicine'},{profession: 'Pediatric Allergy'},{profession: 'Pediatric Anesthesiology (Anesthesiology)'},{profession: 'Pediatric Cardiology'},{profession: 'Pediatric Cardiothoracic Surgery'},{profession: 'Pediatric Critical Care Medicine'},{profession: 'Pediatric Dermatology'},{profession: 'Pediatric Emergency Medicine (Emergency Medicine)'},{profession: 'Pediatric Emergency Medicine (Pediatrics)'},{profession: 'Pediatric Endocrinology'},{profession: 'Pediatric Gastroenterology'},{profession: 'Pediatric Hematology/Oncology'},{profession: 'Pediatric Infectious Disease'},{profession: 'Pediatric Nephrology'},{profession: 'Pediatric Ophthalmology'},{profession: 'Pediatric Orthopedics'},{profession: 'Pediatric Otolaryngology'},{profession: 'Pediatric Pathology'},{profession: 'Pediatric Pulmonology'},{profession: 'Pediatric Radiology'},{profession: 'Pediatric Rehabilitation Medicine'},{profession: 'Pediatric Rheumatology'},{profession: 'Pediatric Surgery (Neurology)'},{profession: 'Pediatric Surgery (Surgery)'},{profession: 'Pediatric Transplant Hepatology'},{profession: 'Pediatric Urology'},{profession: 'Pediatrics'},{profession: 'Pediatrics/Anesthesiology'},{profession: 'Pediatrics/Dermatology'},{profession: 'Pediatrics/Emergency Medicine'},{profession: 'Pediatrics/Medical Genetics'},{profession: 'Pediatrics/Physical Medicine & Rehabilitation'},{profession: 'Pediatrics/Psychiatry/Child & Adolescent Psychiatry'},{profession: 'Pharmaceutical Medicine'},{profession: 'Phlebology'},{profession: 'Physical Medicine & Rehabilitation'},{profession: 'Plastic Surgery'},{profession: 'Plastic Surgery – Integrated'},{profession: 'Plastic Surgery within the Head & Neck'},{profession: 'Plastic Surgery within the Head & Neck (Otolaryngology)'},{profession: 'Plastic Surgery within the Head & Neck (Plastic Surgery)'},{profession: 'Procedural Dermatology'},{profession: 'Proctology'},{profession: 'Psychiatry'},{profession: 'Psychiatry/Family Medicine'},{profession: 'Psychiatry/Neurology'},{profession: 'Psychoanalysis'},{profession: 'Psychosomatic Medicine'},{profession: 'Public Health and General Preventive Medicine'},{profession: 'Pulmonary Critical Care Medicine'},{profession: 'Pulmonary Disease'},{profession: 'Radiation Oncology'},{profession: 'Radiological Physics'},{profession: 'Radiology'},{profession: 'Reproductive Endocrinology and Infertility'},{profession: 'Rheumatology'},{profession: 'Selective Pathology'},{profession: 'Sleep Medicine'},{profession: 'Sleep Medicine (Anesthesiology)'},{profession: 'Sleep Medicine (Internal Medicine)'},{profession: 'Sleep Medicine (Otolaryngology)'},{profession: 'Sleep Medicine (Pediatrics)'},{profession: 'leep Medicine (Psychiatry & Neurology)'},{profession: 'Spinal Cord Injury Medicine'},{profession: 'Sports Medicine (Emergency Medicine)'},{profession: 'Sports Medicine (Family Medicine)'},{profession: 'Sports Medicine (Internal Medicine)'},{profession: 'Sports Medicine (Orthopedic Surgery)'},{profession: 'Sports Medicine (Pediatrics)'},{profession: 'Sports Medicine (Physical Medicine & Rehabilitation)'},{profession: 'Surgery (Obstetrics & Gynecology)'},{profession: 'Surgery (Urology)'},{profession: 'Surgical Critical Care (Surgery)'},{profession: 'Surgical Oncology'},{profession: 'Thoracic Surgery'},{profession: 'Thoracic Surgery - Integrated'},{profession: 'Transplant Hepatology (Internal Medicine)'},{profession: 'Transplant Surgery'},{profession: 'Trauma Surgery'},{profession: 'Undersea & Hyperbaric Medicine (Emergency Medicine)'},{profession: 'Undersea & Hyperbaric Medicine (Preventive Medicine)'},{profession: 'Unspecified'},{profession: 'Urgent Care Medicine'},{profession: 'Urology'},{profession: 'Vascular and Interventional Radiology'},{profession: 'Vascular Medicine'},{profession: 'Vascular Neurology'},{profession: 'Vascular Surgery'},{profession: 'Vascular Surgery- Integrated'} ]
      });


    $(document).ready(function() {

      // the basics
      // ----------

      var substringMatcher = function(strs) {
        return function findMatches(q, cb) {
          var matches, substringRegex;

          // an array that will be populated with substring matches
          matches = [];

          // regex used to determine if a string contains the substring `q`
          substrRegex = new RegExp(q, 'i');

          // iterate through the pool of strings and for any string that
          // contains the substring `q`, add it to the `matches` array
          $.each(strs, function(i, str) {
            if (substrRegex.test(str)) {
              matches.push(str);
            }
          });

          cb(matches);
        };
      };

      var states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
        'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii',
        'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
        'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
        'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
        'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
        'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
        'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
        'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
      ];

      $('#the-basics .typeahead').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
      },
      {
        name: 'states',
        source: substringMatcher(states)
      });

      // bloodhound
      // ----------

      // constructs the suggestion engine
      var states = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.whitespace,
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        // `states` is an array of state names defined in "The Basics"
        local: states
      });

      $('#bloodhound .typeahead').typeahead({
        hint: true,
        highlight: true,
        minLength: 1
      },
      {
        name: 'states',
        source: states
      });

      // prefetch
      // --------

      var countries = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.whitespace,
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        // url points to a json file that contains an array of country names, see
        // https://github.com/twitter/typeahead.js/blob/gh-pages/data/countries.json
        prefetch: '../assets/data/countries.json'
      });

      // passing in `null` for the `options` arguments will result in the default
      // options being used
      $('#prefetch .typeahead').typeahead(null, {
        name: 'countries',
        source: countries
      });

      // scrollable dropdown menu
      // ------------------------

      $('#scrollable-dropdown-menu .typeahead').typeahead(null, {
        name: 'countries',
        limit: 10,
        source: countries
      });

    });

    $(document).ready(function() {
      $('#createAccountLink').click(function(e){
        $('[href*="register"]').trigger('click');
      });
    });

    function nestedSearchToggle(hideSearchOptions) {
      $('.nested-search-options').each(function(index) {
        if ($(this).attr("id") == hideSearchOptions) {
          $(this).show(0);
        }
        else {
          $(this).hide(0);
        }
      })
    }

    function nestedSearchFieldToggle(hideSearchOptions) {
      $('.nested-search-field').each(function(index) {
        if ($(this).attr("id") == hideSearchOptions) {
          $(this).show(0);
        }
        else {
          $(this).hide(0);
        }
      })
    }               

    var json = (function () {
        var json = null;
        $.ajax({
            'async': false,
            'global': false,
            'url': "../assets/data/jobSearchResults.json",
            'dataType': "json",
            'success': function (data) {
                json = data;

                if (data) {
                  var total = data.length.toLocaleString('en');
                }

              $('#resultCount').append(total, " jobs found");
            }
        });
        return json;
    })(); 

    //console.log(JSON.stringify(json[0].job_id));


    $.each(json, function(index, job) {
          if(job.is_featured === "1") {

                var resultRecord = '<tr class="featured">\
                  <th>\
                    <div class="logo-wrapper" style="height:55px;width:80px;position:relative;background-color:white;">\
                      <img src="../assets/images/thumb'+job.member_id+'.jpg" style="max-height:44px;max-width:64px;position: absolute;top: 50%;left:50%;transform: translate(-50%,-50%);">\
                      </div>\
                    </th>\
                  <td><h4 style="margin-top: 0;margin-bottom:0;font-size: 16px;line-height: 20px;"> '+job.job_header+' </h4> '+job.specialty_name+', '+job.facility_name+' </td>\
                  <td><div class="pull-left" style="margin-top: 8px;"><i class="fa fa-map-marker" style="font-size:1.5em;margin-right: 10px;"></i></div><div class="pull-left"><h4 style="margin-top: 0;margin-bottom: 0;font-size: 16px;line-height: 20px;"> '+job.city+',  '+job.state_name+' </h4> United States</div></td>\
                  <td class="text-right" width="170">\
                    <time class="hide-on-hover" style="white-space: nowrap;">Featured</time>\
                    <a class="btn btn-primary pull-right reveal-on-hover" role="button" href="...">&nbsp; Apply Now &nbsp;</a>\
                    <div class="favorite-toggle reveal-on-hover">\
                      <i class="fa fa-star-o pull-right" style="font-size:1.5em;margin-right: 10px;margin-top: 7px;opacity:0.4"></i>\
                      <i class="fa fa-star pull-right" style="font-size:1.5em;margin-right: 10px;margin-top: 7px;display: none;color: #337ab7"></i>\
                  </td>\
                </tr>'; 

                $('#jobSearchResults').append(resultRecord);

                return index<80;

          }

      });

    $.each(json, function(index, job){

      var fmemberName = job.member_name.replace(/ /g,''); // Unused. Pulls out all whitespace from record.
      var fisHighlighted = job.is_highlighted.replace('1','highlight'); // converts value to classname.

      var resultRecord = '<tr class="'+fisHighlighted+'">\
              <th>\
                <div class="logo-wrapper" style="height:55px;width:80px;position:relative;background-color:white;">\
                  <img src="../assets/images/thumb'+job.member_id+'.jpg" style="max-height:44px;max-width:64px;position: absolute;top: 50%;left:50%;transform: translate(-50%,-50%);">\
                  </div>\
                </th>\
              <td><h4 style="margin-top: 0;margin-bottom:0;font-size: 16px;line-height: 20px;"> '+job.job_header+' </h4> '+job.specialty_name+', '+job.facility_name+' </td>\
              <td><div class="pull-left" style="margin-top: 8px;"><i class="fa fa-map-marker" style="font-size:1.5em;margin-right: 10px;"></i></div><div class="pull-left"><h4 style="margin-top: 0;margin-bottom: 0;font-size: 16px;line-height: 20px;"> '+job.city+',  '+job.state_name+' </h4> United States</div></td>\
              <td class="text-right" width="170">\
                <time class="timeago hide-on-hover" datetime="'+job.verified_date+'" title="July 17, 2008" style="white-space: nowrap;"></time>\
                <a class="btn btn-primary pull-right reveal-on-hover" role="button" href="...">&nbsp; Apply Now &nbsp;</a>\
                <div class="favorite-toggle reveal-on-hover">\
                  <i class="fa fa-star-o pull-right" style="font-size:1.5em;margin-right: 10px;margin-top: 7px;opacity:0.4"></i>\
                  <i class="fa fa-star pull-right" style="font-size:1.5em;margin-right: 10px;margin-top: 7px;display: none;color: #337ab7"></i>\
              </td>\
            </tr>'; 

     $('#jobSearchResults').append(resultRecord);

     return index<1000;   

    });


    // Show time since date
    $(document).ready(function() {
      jQuery("time.timeago").timeago();
    });

    // Toggle favorite icon  
    $(".favorite-toggle").click(function() {
        $(this).children().toggle();
        $(this).parent().parent().toggleClass('selected')
        $(this).toggleClass('reveal-on-hover');
        $(this).parent().toggleClass('reveal-while-active');
    });
