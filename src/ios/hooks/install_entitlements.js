var logString = "";
var hasInit = false;
var logStream;
var initLog = function (iosFolder) {
    var dest = path.join(iosFolder, 'www', 'cordova_log.txt');
    logStream = fs.createWriteStream(dest, {
        'flags': 'a'
    });
    hasInit = true;
    // use {'flags': 'a'} to append and {'flags': 'w'} to erase and write a new file
    // logStream.write('install entitlements');

};
var console_log = function (txt) {
    if (hasInit) {
      if (logString) {
        logStream.write(logString);
        logString = '';  
      }
      logStream.write(txt);  
    } else {
      logString += txt + '\n';
    }
    console.error(txt);
};
var writeLog = function (iosFolder) {
    // var fs = require('fs');
    // fs.writeFile(dest, logString, function (err) {
    //     if (err) {
    //         return console.log(err);
    //     }
    // });
    logStream.end('end');
};

// using error to see if this shows up in AB
console_log("Running hook to add iCloud entitlements");

var xcode = require('xcode'),
    fs = require('fs'),
    path = require('path');

module.exports = function (context) {
    var Q = context.requireCordovaModule('q');
    var deferral = new Q.defer();

    if (context.opts.cordova.platforms.indexOf('ios') < 0) {
        throw new Error('This plugin expects the ios platform to exist.');
    }

    var iosFolder = context.opts.cordova.project ? context.opts.cordova.project.root : path.join(context.opts.projectRoot, 'platforms/ios/');
    console_log("iosFolder: " + iosFolder);

    initLog(iosFolder);

    var data = fs.readdirSync(iosFolder);
    var projFolder;
    var projName;

    // Find the project folder by looking for *.xcodeproj
    if (data && data.length) {
        data.forEach(function (folder) {
            if (folder.match(/\.xcodeproj$/)) {
                projFolder = path.join(iosFolder, folder);
                projName = path.basename(folder, '.xcodeproj');
            }
        });
    }

    if (!projFolder || !projName) {
        console_log("Could not find an .xcodeproj folder in: " + iosFolder);
        throw new Error("Could not find an .xcodeproj folder in: " + iosFolder);
    }

    var destFile = path.join(iosFolder, projName, 'Resources', projName + '.entitlements');
    if (fs.existsSync(destFile)) {
        console_log("File exists, not doing anything: " + destFile);
    } else {
        var sourceFile = path.join(context.opts.plugin.pluginInfo.dir, 'src/ios/resources/iCloud.entitlements');
        var entData = fs.readFileSync(sourceFile, 'utf8');
        var resourcesFolderPath = path.join(iosFolder, projName, 'Resources');
        fs.existsSync(resourcesFolderPath) || fs.mkdirSync(resourcesFolderPath);
        fs.writeFileSync(destFile, entData);

        var projectPath = path.join(projFolder, 'project.pbxproj');

        var pbxProject;
        if (context.opts.cordova.project) {
            pbxProject = context.opts.cordova.project.parseProjectFile(context.opts.projectRoot).xcode;
        } else {
            pbxProject = xcode.project(projectPath);
            pbxProject.parseSync();
        }

        pbxProject.addResourceFile(projName + ".entitlements");

        var configGroups = pbxProject.hash.project.objects['XCBuildConfiguration'];
        for (var key in configGroups) {
            var config = configGroups[key];
            if (config.buildSettings !== undefined) {
                config.buildSettings.CODE_SIGN_ENTITLEMENTS = '"' + projName + '/Resources/' + projName + '.entitlements"';
            }
        }

        // write the updated project file
        fs.writeFileSync(projectPath, pbxProject.writeSync());
        console_log("Added iCloud entitlements to project '" + projName + "'");

        writeLog(iosFolder, projName);
    }
};