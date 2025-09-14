/////////////////////////////////////////////////////////////////////
// Class Repository
/////////////////////////////////////////////////////////////////////
// Provide CRUD operations on JSON file of data of a specific model
/////////////////////////////////////////////////////////////////////
// Author : Nicolas Chourot
// Lionel-Groulx College
// 2025
/////////////////////////////////////////////////////////////////////
import fs from "fs";
import * as utilities from "../utilities.js";

export default class Repository {
    constructor(model) {
        if (model == null) {
            throw new Error("Cannot instantiate a repository with a null model.");
        }
        this.objectsList = null;
        this.model = model;
        this.objectsName = model.getClassName() + "s";
        this.objectsFile = `./jsonFiles/${this.objectsName}.json`;
        this.errorMessages = [];
    }
    valid() {
        let valid = this.errorMessages.length == 0;
        return valid;
    }
    objects() {
        // Check if data is not already in memory
        if (this.objectsList == null) 
            this.read();
        return this.objectsList;
    }
    read() {
        try {
            let rawdata = fs.readFileSync(this.objectsFile);
            // we assume here that the json data is formatted correctly
            this.objectsList = JSON.parse(rawdata);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // file does not exist, it will be created on demand
                console.log(FgYellow, `Warning ${this.objectsName} repository does not exist. It will be created on demand`);
                this.objectsList = [];
            } else {
                console.log(FgRed, `Error while reading ${this.objectsName} repository`);
                console.log(FgRed, '--------------------------------------------------');
                console.log(FgRed, error);
            }
        }
    }
    write() {
        fs.writeFileSync(this.objectsFile, JSON.stringify(this.objectsList));
    }
    createId() {
        if (this.model.securedId) {
            let newId = '';
            do { newId = uuidv1(); } while (this.indexOf(newId) > -1);
            return newId;
        } else {
            let maxId = 0;
            for (let object of this.objects()) {
                if (object.Id > maxId) {
                    maxId = object.Id;
                }
            }
            return maxId + 1;
        }
    }

    checkConflict(instance) {
        let conflict = false;
        if (this.model.key)
            conflict = this.findByField(this.model.key, instance[this.model.key], instance.Id) != null;
        if (conflict) {
            this.model.addError(`Unicity conflict on [${this.model.key}]...`);
            this.model.state.inConflict = true;
        }
        return conflict;
    }
    add(object) {
        delete object.Id;
        if (this.model.securedId)
            object = { "Id": '', ...object };
        else
            object = { "Id": 0, ...object };
        this.model.validate(object);
        if (this.model.state.isValid) {
            this.checkConflict(object);
            if (!this.model.state.inConflict) {
                object.Id = this.createId();
                this.objectsList.push(object);
                this.write();
            }
        }
        return object;
    }
    update(id, object) {
        let objectToModify = { ...object };
        delete objectToModify.Id;
        if (!this.model.securedId)
            id = parseInt(id);
        objectToModify.Id = id;
        this.model.validate(objectToModify);
        if (this.model.state.isValid) {
            let index = this.indexOf(objectToModify.Id);
            if (index > -1) {
                this.checkConflict(objectToModify);
                if (!this.model.state.inConflict) {
                    this.objectsList[index] = objectToModify;
                    this.write();
                }
            } else {
                this.model.addError(`The resource [${objectToModify.Id}] does not exist.`);
                this.model.state.notFound = true;
            }
        }
        return objectToModify;
    }
    remove(id) {
        let index = 0;
        if (!this.model.securedId)
            id = parseInt(id);
        for (let object of this.objects()) {
            if (object.Id === id) {
                this.objectsList.splice(index, 1);
                this.write();
                return true;
            }
            index++;
        }
        return false;
    }
    getAll() {
        return this.objects();
    }
    get(id) {
        if (!this.model.securedId)
            id = parseInt(id);
        for (let object of this.objects()) {
            if (object.Id === id) {
                return object;
            }
        }
        return null;
    }
    removeByIndex(indexToDelete) {
        if (indexToDelete.length > 0) {
            utilities.deleteByIndex(this.objects(), indexToDelete);
            this.write();
        }
    }
    keepByFilter(filterFunc) {
        let objectsList = this.objects();
        if (objectsList) {
            this.objectsList = objectsList.filter(filterFunc);
            this.write();
        }
    }
    findByFilter(filterFunc) {
        let objectsList = this.objects();
        if (objectsList) {
            return objectsList.filter(filterFunc);
        }
        return null;
    }
    findByField(fieldName, value, excludedId = 0) {
        if (!this.model.securedId && excludedId != 0)
            excludedId = parseInt(excludedId);
        if (fieldName) {
            let index = 0;
            for (let object of this.objects()) {
                try {
                    if (object[fieldName] === value) {
                        if (object.Id !== excludedId) return this.objectsList[index];
                    }
                    index++;
                } catch (error) { break; }
            }
        }
        return null;
    }
    indexOf(id) {
        if (!this.model.securedId)
            id = parseInt(id);
        let index = 0;
        for (let object of this.objects()) {
            if (object.Id == id) return index;
            index++;
        }
        return -1;
    }
}
