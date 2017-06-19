const Q = require('q');
const tl = require('vsts-task-lib/task');
const fs = require('fs');
const path = require('path');

var varUtility = require ('./variableutility.js');
var ltxdomutility = require("./ltxdomutility.js");
var fileEncoding = require('./fileencoding.js');

function substituteAppSettingsVariables(folderPath, isFolderBasedDeployment) {
    var configFiles = tl.findMatch(folderPath, "**/*.config");
    var variableMap = varUtility.getVariableMap();
    var tags = ["appSettings", "connectionStrings"];
    for(var configFile of configFiles) {
        substituteXmlVariables(configFile, tags, variableMap);
    }
}

function substituteXmlVariables(configFile, tags, variableMap) {
    if(!tl.exist(configFile)) {
        throw new Error(tl.loc("Configfiledoesntexists", configFile));
    }
    if( !tl.stats(configFile).isFile()) {
        return;
    }
    tl.debug("Initiated variable substitution in config file : " + configFile);
    var fileBuffer = fs.readFileSync(configFile);
    var fileEncodeType = fileEncoding.detectFileEncoding(configFile, fileBuffer);
    var webConfigContent = fileBuffer.toString(fileEncodeType[0]);
    if(fileEncodeType[1]) {
        webConfigContent = webConfigContent.slice(1);
    }
    var xmlDocument;
    try{
        xmlDocument = ltxdomutility.initializeDOM(webConfigContent);
    } 
    catch(error) {
        tl.debug("Unable to parse file : " + configFile);
        tl.debug(error);
        return;
    }
    var replacableTokenValues = {};
    for(var tag of tags) {
        var nodes = ltxdomutility.getElementsByTagName(tag); 
        if(nodes.length == 0) {
            tl.debug("Unable to find node with tag '" + tag + "' in provided xml file.");
            continue;
        }
        for(var xmlNode of nodes) {
            if(varUtility.isObject(xmlNode)){
                tl.debug("Processing substitution for xml node : " + xmlNode.name);
                try {
                    if(xmlNode.name == "connectionStrings") {
                        updateXmlConnectionStringsNodeAttribute(xmlNode, variableMap, replacableTokenValues);
                    }
                    else {
                        updateXmlNodeAttribute(xmlNode, variableMap, replacableTokenValues);
                    }
                } catch (error){
                    tl.debug("Error occurred while processing xml node : " + xmlNode.name);
                    tl.debug(error);
                }
            }  
        }
    }
    var domContent = ( fileEncodeType[1]? '\uFEFF' : '' ) + ltxdomutility.getContentWithHeader(xmlDocument);
    for(var replacableTokenValue in replacableTokenValues) {
        tl.debug('Substituting original value in place of temp_name: ' + replacableTokenValue);
        domContent = domContent.split(replacableTokenValue).join(replacableTokenValues[replacableTokenValue]);
    }
    tl.writeFile(configFile, domContent, fileEncodeType[0]);
    tl.debug("Config file " + configFile + " updated.");
}

function updateXmlNodeAttribute(xmlDomNode, variableMap, replacableTokenValues) {

    if (varUtility.isEmpty(xmlDomNode) || !varUtility.isObject(xmlDomNode) || xmlDomNode.name == "#comment") {
        tl.debug("Provided node is empty or a comment.");
        return;
    }
    var xmlDomNodeAttributes = xmlDomNode.attrs;
    const ConfigFileAppSettingsToken = 'CONFIG_FILE_SETTINGS_TOKEN';
    for(var attributeName in xmlDomNodeAttributes) {
        var attributeNameValue = (attributeName === "key") ? xmlDomNodeAttributes[attributeName] : attributeName;
        var attributeName = (attributeName === "key") ? "value" : attributeName;
        if(variableMap[attributeNameValue]) {
            var ConfigFileAppSettingsTokenName = ConfigFileAppSettingsToken + '(' + attributeNameValue + ')';
            tl.debug('Updating value for key=' + attributeNameValue + 'with token_value: ' + ConfigFileAppSettingsTokenName);
            xmlDomNode.attr(attributeName, ConfigFileAppSettingsTokenName);
            replacableTokenValues[ConfigFileAppSettingsTokenName] =  variableMap[attributeNameValue].replace(/"/g, "'");
        }
    }
    var children = xmlDomNode.children;
    for(var childNode of children) {
        if(varUtility.isObject(childNode)) {
            updateXmlNodeAttribute(childNode, variableMap, replacableTokenValues);
        }
    }
}

function updateXmlConnectionStringsNodeAttribute(xmlDomNode, variableMap, replacableTokenValues) {

    const ConfigFileConnStringToken = 'CONFIG_FILE_CONN_STRING_TOKEN';
    if (varUtility.isEmpty(xmlDomNode) || !varUtility.isObject(xmlDomNode) || xmlDomNode.name == "#comment") {
        tl.debug("Provided node is empty or a comment.");
        return;
    }
    var xmlDomNodeAttributes = xmlDomNode.attrs;

    if(xmlDomNodeAttributes.hasOwnProperty("connectionString")) {
        if(xmlDomNodeAttributes.hasOwnProperty("name") && variableMap[xmlDomNodeAttributes.name]) {
            var ConfigFileConnStringTokenName = ConfigFileConnStringToken + '(' + xmlDomNodeAttributes.name + ')';
            tl.debug('Substituting connectionString value for name=' + xmlDomNodeAttributes.name + ' with token_value: ' + ConfigFileConnStringTokenName);
            xmlDomNode.attr("connectionString", ConfigFileConnStringTokenName);
            replacableTokenValues[ConfigFileConnStringTokenName] = variableMap[xmlDomNodeAttributes.name].replace(/"/g, "'");
        }
        else if(variableMap["connectionString"]) {
            var ConfigFileConnStringTokenName = ConfigFileConnStringToken + '(connectionString)';
            tl.debug('Substituting connectionString value for connectionString=' + xmlDomNodeAttributes.name + ' with token_value: ' + ConfigFileConnStringTokenName);
            xmlDomNode.attr("connectionString", ConfigFileConnStringTokenName);
            replacableTokenValues[ConfigFileConnStringTokenName] = variableMap["connectionString"].replace(/"/g, "'");
        }
    }

    var children = xmlDomNode.children;
    for(var childNode of children) {
        if(varUtility.isObject(childNode)) {
            updateXmlConnectionStringsNodeAttribute(childNode, variableMap, replacableTokenValues);
        }
    }
}

exports.substituteAppSettingsVariables = substituteAppSettingsVariables
