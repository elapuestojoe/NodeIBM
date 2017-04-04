var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

//Setup
process.env.GOPATH = __dirname;

var fs = require('fs');
var Ibc1 = require('ibm-blockchain-js'); // doc https://github.com/IBM-Blockchain/ibm-blockchain-js#ibcjs
var ibc = new Ibc1();

var peers;
var users;
var chaincode = null;

init();
despliegaUObtieneChaincode(prefer_type1_users(users));

getUserIndex().then(function(userIndex) {
	console.log(userIndex);
})

//Descomentar en produccion
//setNodes();

//

// getUserIndex().then(function(userIndex){
// 	console.log(userIndex);
// }).catch((error) => {
// 	console.log(error)
// });

// addNode("banorteUser", "banortePassword", "hsbcUser", "hsbcPassword").then(function(response) {

// 	if(response){
// 		console.log(response);
// 	} else {

// 	}
// }).catch((error) => {
// 	console.log(error)
// });

// OBTENER NODOS
// getNodes().then(function(response) {
// 	console.log(response);
// });

function init() {
	var manual = JSON.parse(fs.readFileSync(__dirname + '/ServiceCredentials.json', 'utf8'));
	peers = manual.peers;
	console.log('Cargando Peers...');
	if(manual.users) users = manual.users;
	console.log('Cargando Usuarios...');
}

//Despliega chaincode en blockchain
function despliegaUObtieneChaincode(serviceCredentials, cb){

	options = 	{
					network:{
						peers: [peers[0]], //Peer a utilizar para ejecutar el despliegue del chaincode
						users: serviceCredentials, //Credenciales a utilizar para ejecutar el despliegue del chaincode
						options: {
									quiet: true,
									tls: detect_tls_or_not(peers),
									maxRetry: 1
								 }
					},
					chaincode:{
						zip_url: 'https://github.com/elapuestojoe/IBMProyecto/raw/master/chaincode_example_personas.go.zip',
						unzip_dir: '/',
						git_url: 'https://github.com/elapuestojoe/IBMProyecto',
						deployed_name: '3e1322b3668ad94e8461329153595ee191f19a57754fae672ba51e55dc7f1bb18a14d6895f103b4509fcfb1d996776a1184aaf75541a609cfaf81289682a3bdc'
					}
				};

	//Desplegamos el chaincode
	ibc.load(options, function (err, cc){
		if(err != null){
			console.log('No se pudo desplegar el chaincode.\n', err);
			if(!process.error) process.error = {type: 'load', msg: err.details};
		}
		else{
			chaincode = cc;

			//Si se especifico 'deployed_name' en 'options' se asume que ya tenemos un chaincode desplegado,
			//de lo contrario desplegamos el chaincode.
			if(!cc.details.deployed_name || cc.details.deployed_name === ''){
				cc.deploy('init', ["ful123","{\"nombre\":\"Fulanito\",\"ap_pat\":\"Perengano\",\"comp_dom\":\"Base64 del documento\"}"], {delay_ms: 60000}, function(e){
					console.log("Revisar en bluemix si se desplego el chaincode...")
				});
			}
			else{
				console.log('Chaincode ya se ha desplegado anteriormente...');
			}

			//Mandamos a llamar a la funcion de callback, si aplica.
			if(cb){
				cb();
			}
		}
	});
}

//Set initial MASTER NODE
function setNodes() {
	console.log('setMasterNode');
	return new Promise(function(resolve, reject) {
		despliegaUObtieneChaincode(prefer_type1_users(users), function () {

			var NODES = {}
			NODES.banorteUser = "banortePassword"

			chaincode.invoke.nuevo(["NODES", JSON.stringify(NODES)], function(e, response) {

				if(e != null) {
					reject("Error");
				} else {
					console.log("MASTERNODE created")
					resolve(response);
				}
			});
		});
	});
}

//Get User Index
function getUserIndex(){
	return new Promise(function(resolve, reject) {
		readFromChain("USERINDEX").then(function(userIndex) {

			if(userIndex) {
				resolve(userIndex);
			} else {
				reject("ERROR OBTENIENDO USER INDEX");
			}
		}).catch((error) => {
			console.log("No USERINDEX, creating one");
			
			writeToChain("USERINDEX", "1").then(function(response) {

				if(response) {
					resolve(1)
				} else {
					reject("Error creating user index");
				}
			})
		});;
	});
}

function setUserIndex(newIndex){
	return new Promise(function(resolve, reject) {

		writeToChain("USERINDEX", newIndex).then(function (response){
			if(response) {
				resolve(newIndex);
			} else {
				reject("ERROR");
			}
		});
	});
}

function resetUserIndex() {
	return new Promise(function(resolve, reject) {

		writeToChain("USERINDEX", 1).then(function (response){
			if(response) {
				resolve(newIndex);
			} else {
				reject("ERROR");
			}
		});
	});
}

//Obtener Nodos Actuales y regresar diccionario
function getNodes() {
	return new Promise(function(resolve, reject) {
		readFromChain("NODES").then(function(nodes) {
			if(nodes) {
				resolve(JSON.parse(nodes));
			} else {
				reject("ERROR OBTENIENDO NODOS");
			}
		});
	});
}

function authenticateNode(adminUser, adminPassword) {
	return new Promise(function(resolve, reject) {
		getNodes().then(function(nodes) {
			if(nodes) {
				console.log(nodes);
				resolve(nodes[adminUser] == adminPassword);
			} else {
				reject("Error de Autenticacion");
			}
		});
	});
}

function addNode(adminUser, adminPassword, newNodeUser, newNodePassword) {
	return new Promise(function (resolve, reject) {
		authenticateNode(adminUser, adminPassword).then(function(result) {
			//Autenticacion correcta
			if(result) {
				getNodes().then(function(nodes) {

					if(nodes) {
						nodes[newNodeUser] = newNodePassword;

						writeToChain("NODES", JSON.stringify(nodes)).then(function(response) {
							if(response) {
								resolve("NODE ADDED");
							} else {
								reject("ERROR ADDING NODE")
							}
						});
					} else {
						reject("ERROR ADDING NODE");
					}
				})
			} else {
				reject("Bad User/Password");
			}
		});
	});
}

//TODO JSON PARSE

function updateInfoUser(adminUser, adminPassword, userIndex, campoNuevo, valorNuevo) {
	return new Promise(function (resolve, reject) {
		authenticateNode(adminUser, adminPassword).then(function (result) {

			if(userIndex && campoNuevo && valorNuevo) {
				if(result) {

					readFromChain(userIndex).then(function (user) {

						userJSON = JSON.parse(user);

						newBlock = {};
						newBlock.keyValue = valorNuevo;
						newBlock.signature = adminUser;
						userJSON[campoNuevo] = newBlock;

						if(userJSON.syncronizedFields[campoNuevo]) {
							var nodesToUpdate = userJSON.syncronizedFields[campoNuevo];


							for (var i = nodesToUpdate.length - 1; i >= 0; i--) {
								var node = nodesToUpdate[i];
								var info = [[campoNuevo, newBlock]];
								sendInfoToNode(node, userIndex, info);
							};
						}

						writeToChain(userIndex, JSON.stringify(userJSON)).then(function(response){
							resolve(response);
						}).catch((error) => {
							reject(error);
						});

					}).catch((error) => {
						reject("User doesnt exist");
					});
				} else {
					reject("Bad User/Password");
				}
			} else {
				reject("userIndex, new key and new value cant be empty");
			}
		})
	});
}

function appendInfoToUser(adminUser, adminPassword, userIndex, fieldArray) {
	console.log("appendInfoToUser");
	return new Promise(function (resolve, reject) {
		authenticateNode(adminUser, adminPassword).then(function (result) {

			if(userIndex && fieldArray) {
				if(result) {

					readFromChain(userIndex).then(function (user) {
						
						userJSON = JSON.parse(user);
						for (var i = fieldArray.length - 1; i >= 0; i--) {

							var field = fieldArray[i];
							var key = field[0];
							var info = {};
							info.keyValue = field[1];
							info.signature = adminUser;
							userJSON[key] = info;
						};
						writeToChain(userIndex, JSON.stringify(userJSON)).then(function(response){
							resolve(response);
						}).catch((error) => {
							reject(error);
						});

					}).catch((error) => {
						reject("User doesnt exist");
					});
				} else {
					reject("Bad User/Password");
				}
			} else {
				reject("userIndex, new key and new value cant be empty");
			}
		})
	});
}


	// 	readFromChain("USERINDEX").then(function(userIndex) {

	// 		if(userIndex) {
	// 			resolve(userIndex);
	// 		} else {
	// 			reject("ERROR OBTENIENDO USER INDEX");
	// 		}
	// 	}).catch((error) => {
	// 		console.log("No USERINDEX, creating one");
			
	// 		writeToChain("USERINDEX", "1").then(function(response) {

	// 			if(response) {
	// 				resolve(1)
	// 			} else {
	// 				reject("Error creating user index");
	// 			}
	// 		})
	// 	});;
	// });

function createUser(nodeUsername, nodePassword, password) {
	return new Promise(function (resolve, reject) {

		authenticateNode(nodeUsername, nodePassword).then(function(result) {

			if(result) {

				getUserIndex().then(function (index) {

					if(index) {

						indexNumber = parseInt(index, 10);
						indexNumber += 1;

						//Descomentar para resetear
						//indexNumber = 1;

						setUserIndex(""+indexNumber).then(function (response) {
							if(response) {

								user = {}
								user.password = password;
								user.requestsIndex = 0;
								writeToChain(index, JSON.stringify(user)).then(function (r) {
									if(r){
										resolve(index);
									} else {
										reject("Error creating user");
									}
								}).catch((error) => {
									reject("Error creating user");
								});

							} else {
								reject("Error creating user");
							}
						});

					} else {
						reject("Error creating user");
					}

				}).catch((error) => {
					reject(error);
				});

			} else {
				reject("Bad User/Password");
			}

		});
	});
}

//Test Consulta
//Consulta la informacion de una persona
function consultaPersona(serviceCredentials){
	despliegaUObtieneChaincode(serviceCredentials, function (){
		console.log('Consultando...');

		//TODO - Autenticar al nodo que quiere hacer la consulta
		//var pass = obtieneNodo("ban123")
		//if(passNodo = pass){

		chaincode.query.read(["jma123"], function(e, persona) {
			if(e != null) console.log('No se pudo obtener la persona:', e);
			else {
				if(persona) console.log(persona);
			}
		});

		//}
		//else{
		//   console.log('Usuario / Password incorrectos...');
		//}
	});
}

function requestInformation(nodeUsername, nodePassword, userIndex, keys, dateForRequest) {
	console.log("requestInformation");

	//Crea el paquete
	var request = {};
	request.node = nodeUsername;
	request.keys = keys; //Array of keys
	request.dateForRequest = dateForRequest;
	return new Promise(function (resolve, reject) {

		readFromChain(userIndex).then(function (user) {
						
			userJSON = JSON.parse(user);

			//Index de request
			request.requestIndex = userJSON.requestsIndex;
			userJSON.requestsIndex = userJSON.requestsIndex + 1;
			if(!userJSON.requests) {
				userJSON.requests = [];
			}

			userJSON.requests.push(request);

			writeToChain(userIndex, JSON.stringify(userJSON)).then(function(response){
				resolve(response);
			}).catch((error) => {
				reject(error);
			});
		}).catch((error) => {
			reject(error);
		});
	});
}

//Test Registra
function registraPersona(serviceCredentials){
	despliegaUObtieneChaincode(serviceCredentials, function (){
		console.log('Registrando Persona...');

		//TODO - Autenticar al nodo que quiere hacer la consulta
		//var pass = obtieneNodo("ban123")
		//if(passNodo = pass){

			chaincode.invoke.nuevo(["jma123","{\"nombre\":\"Jorge\",\"ap_pat\":\"Miramontes\",\"comp_dom\":\"Base64 del documento\"}"], function(e, persona) {
						if(e != null) console.log('No se pudo obtener la persona:', e);
						else {
							if(persona) console.log(persona);
						}
			});

		//}
		//else{
		//   console.log('Usuario / Password incorrectos...');
		//}
	});
}

// ============================================================================================================================
// Funciones de Utileria
// ============================================================================================================================

//Write to chain with promises
function writeToChain(key, info) {
	return new Promise(function(resolve, reject) {
		console.log('writeToChain');
		despliegaUObtieneChaincode(prefer_type1_users(users), function () {
			chaincode.invoke.nuevo([key, info], function(e, response) {

				if(e != null) {
					reject("Error");
				} else {
					resolve(response);
				}
			});
		});
	});
}

//Read from chain with promises
function readFromChain(key) {
	console.log('readFromChain')
	return new Promise(function(resolve, reject) {
		despliegaUObtieneChaincode(prefer_type1_users(users), function() {
			chaincode.query.read([key], function(e, response) {
				if(e != null) {
					reject("Error");
				}
				else {
					resolve(response);
				}
			});
		});
	});
}

//filter for type1 users if we have any
function prefer_type1_users(user_array){
	var ret = [];
	for(var i in users){
		if(users[i].enrollId.indexOf('type1') >= 0) {	//gather the type1 users
			console.log("users[i]: " + JSON.stringify(users[i]));
			ret.push(users[i]);
		}
	}

	if(ret.length === 0) ret = user_array;				//if no users found, just use what we have
	return ret;
}

//see if peer 0 wants tls or no tls
function detect_tls_or_not(peer_array){
	var tls = false;
	if(peer_array[0] && peer_array[0].api_port_tls){
		if(!isNaN(peer_array[0].api_port_tls)) tls = true;
	}
	return tls;
}

//

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

//Servicios

//Get Info object
router.post("/nodo/login", function (req, res, next) {
	console.log("/nodo/login");
	console.log(req.body);

	var username = req.body.username;
	var password = req.body.password;

	authenticateNode(username, password).then(function (response) {

		if(response) {
			res.send("SUCCESFUL\n");
		} else {
			res.send("BAD LOGIN\n");
		}
	}).catch((error) => {
 		console.log(error);
 		res.send(error);
 	});
});

router.post("/nodo/add", function (req, res,next) {
	console.log("/nodo/add");
	console.log(req.body);

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;

	var newNodeUsername = req.body.newNodeUsername;
	var newNodePassword = req.body.newNodePassword;

	if(newNodeUsername && newNodePassword) {
		addNode(nodeUsername, nodePassword, newNodeUsername, newNodePassword).then(function (response) {

			if(response) {
				res.send("Nodo agregado\n");
			} else {
				console.log(error);
				res.send("Error agregando nodo\n");
			}
		}).catch((error) => {
			console.log(error);
			res.send(error);
		});
	} else {
		res.send("Nuevo nodo debe tener un usuario / contraseña\n")
	}
})

router.post('/user/new', function (req, res, next) {
	console.log("crearUsuario");
	console.log(req.body);

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;
	var userPassword = req.body.userPassword;

	var nombre = ["nombre", req.body.nombre];
	var apellidoMaterno = ["apellidoMaterno", req.body.apellidoMaterno];
	var apellidoPaterno = ["apellidoPaterno", req.body.apellidoPaterno];
	var direccion = ["direccion", req.body.direccion];

	fieldArray = [nombre, apellidoMaterno, apellidoPaterno, direccion];

	if(userPassword && req.body.nombre &&  req.body.apellidoMaterno && req.body.apellidoPaterno
		 && req.body.direccion) {
		createUser(nodeUsername, nodePassword, userPassword).then(function (response) {
			if(response) {
				var userIndex = response;
				appendInfoToUser(nodeUsername, nodePassword, response, fieldArray).then(function (response) {
					if(response) {
						res.send("User created with Index: "+userIndex+"\n");
					} else {
						res.send("Error\n");
					}
				}).catch((error) =>{
					res.send(error+"\n");
				});

			} else {
				res.send("Error agregando usuario\n");
			}
		}).catch((error) => {
			res.send(error);
		});
	} else {
		res.send("User password, name, last name, family name and address cant be empty\n");
	}
});

router.post("/user/update", function(req, res, next) {
	console.log("/user/update");
	console.log(req.body);

	var userIndex = req.body.userIndex;

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;

	var key = req.body.key;
	var newValue = req.body.newValue;

	//TODO VALIDACION
	if(userIndex) {
		updateInfoUser(nodeUsername, nodePassword, userIndex, key, newValue).then(function (response) {
			res.send("User info updated\n")
		}).catch((error) => {
			res.send(error + "\n");
		});
	} else {
		res.send("User index cant be empty\n");
	}
})

router.post("user/updateMultipleValues", function(req, res, next) {
	console.log("/user/updateMultipleValues");
	console.log(req.body);

	var userIndex = req.body.userIndex;

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;

	var fields = req.body.fields;

	//function appendInfoToUser(adminUser, adminPassword, userIndex, fieldArray) {
	if(userIndex) {
		appendInfoToUser(nodeUsername, nodePassword, userIndex, fields).then(function (response) {
			res.send("User info updated\n");
		}).catch((error) => {
			res.send(error + "\n");
		});
	} else {
		res.send("User index cant be empty\n");
	}
});

router.post("/user/get", function (req, res, next) {
	console.log("/user/get");
	console.log(req.body);

	var userIndex = req.body.userIndex;

	if(userIndex) {

		readFromChain(userIndex).then(function (response) {
			res.send(response+"\n");
		}).catch((error) =>{
			res.send("User does not exist\n");
		});

	} else {
		res.send("User index cant be empty\n");
	}
});

router.post("/user/getField", function (req, res, next) {
	console.log("/user/getField");
	console.log(req.body);

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;
	var userIndex = req.body.userIndex;
	var key = req.body.key;

	if(userIndex && key) {
		readFromChain(userIndex).then(function (response) {
			var userJSON = JSON.parse(response);

			var value = userJSON[key].keyValue;
			var signature = userJSON[key].signature;

			if(value){
				res.send(key + " : " + value + ". Signed by: " + signature + "\n");
			} else {
				res.send("Key does not exist in user");
			}

		}).catch((error) => {
			res.send(error+"\n");
		});
	} else {
		res.send("User index and field cant be empty\n");
	}

})

//REQUEST USER INFO
router.post("/node/requestUserInfo", function (req, res, next) {
	console.log("node/requestUserInfo");
	console.log("req.body");

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;
	var userIndex = req.body.userIndex;

	//new Date(Date.parse("2005-07-08"));
	//2005, Julio 8
	var dateForRequest = req.body.dateForRequest;
	var keys = req.body.keys;

	authenticateNode(nodeUsername, nodePassword).then(function (response) {

		if(response) {
			//Autenticado, agregar cosas
			requestInformation(nodeUsername, nodePassword, userIndex, keys, dateForRequest).then(function(response){

				res.send("Request sent to user\n");
			}).catch((error) => {
				res.send(error+"\n");
			});

		} else {
			res.send(error+"\n");
		}
	}).catch((error) => {
		res.send(error + "\n");
	});
})

function getRequests(userIndex) {
	return new Promise(function (resolve, reject) {
		readFromChain(userIndex).then(function (user) {
			userJSON = JSON.parse(user);

			resolve(userJSON.requests);
		}).catch((error)=> {
			reject(error+"\n");
		});
	});
}

router.post("/user/getRequests", function(req, res, next) {
	console.log("user/getRequests");
	var userIndex = req.body.userIndex;
	var userPassword = req.body.userPassword;
	authenticateUser(userIndex, userPassword).then( function(response) {

		if(response) {
			getRequests(userIndex).then(function (requests) {
				res.send(requests);
			}).catch((error) => {
				res.send(error+"\n");
			});	
		} else {
			res.send("Bad login");
		}
	}).catch((error) => {
		res.send(error+"\n");
	});
});

function authenticateUser(userIndex, userPassword) {
	return new Promise(function (resolve, reject) {
		readFromChain(userIndex).then(function (user) {

			userJSON = JSON.parse(user);

			resolve(userJSON.password == userPassword);
		}).catch((error) => {
			reject(false);
		});
	});
}
router.post("/user/login", function(req, res, next) {
	console.log("user/login");

	var userIndex = req.body.userIndex;
	var userPassword = req.body.userPassword;

	authenticateUser(userIndex, userPassword).then(function (response) {
		res.send(response);
	}).catch((error) => {
		res.send(error);
	});
});

function sendInfoToNode(nodeUsername, userIndex, infoApproved) {
	console.log("SENDINFOTONODE");
	return new Promise(function (resolve, reject) {

		
		readFromChain(nodeUsername+"-"+userIndex).then(function (nodeAndUser) {
			var nodeUserInfo = JSON.parse(nodeAndUser);

			for (var i = infoApproved.length - 1; i >= 0; i--) {
				var info = infoApproved[i];

				var key = info[0]
				var newInfo = {}
				newInfo.keyValue = info[1].keyValue;
				newInfo.signature = info[1].signature;

				var oldDate = nodeUserInfo[key].endDate;
				if(info[2]) {
					newInfo.endDate = info[2];
				} else {
					newInfo.endDate = oldDate;
				}
				nodeUserInfo[key] = newInfo;
			};
			console.log("AYUDA");
			console.log(nodeUserInfo);
			writeToChain(nodeUsername+"-"+userIndex, JSON.stringify(nodeUserInfo)).then(function (result) {

				if(result) {
					resolve("Info agregada a nodo");
				} else {
					reject("Error");
				}
			}).catch((error) => {
				reject(error);
			});
		}).catch((error) => {

			console.log("AYUDA");
			console.log(error);
			//No existe, debemos crearlo
			var nodeUserInfo = {};

			for (var i = infoApproved.length - 1; i >= 0; i--) {
				var info = infoApproved[i];
				var key = info[0]
				var newInfo = {}
				newInfo.keyValue = info[1].keyValue;
				newInfo.signature = info[1].signature;
				newInfo.endDate = info[2];
				nodeUserInfo[key] = newInfo;
			};

			writeToChain(nodeUsername+"-"+userIndex, JSON.stringify(nodeUserInfo)).then(function (result) {

				if(result) {
					resolve("Info agregada a nodo");
				} else {
					reject("Error");
				}
			}).catch((error) => {
				reject(error);
			});
		});
	})
}

function handleRequest(userIndex, userPassword, requestIndex, keys) {
	return new Promise(function (resolve, reject) {

		//Get user 
		readFromChain(userIndex).then(function (user) {

			var userJSON = JSON.parse(user);
			var infoApproved = [];

			var dateForRequest = userJSON.requests[requestIndex].dateForRequest;
			var nodeUsername = userJSON.requests[requestIndex].node;

			if(!userJSON.syncronizedFields) {
				userJSON.syncronizedFields = {}
			}

			for (var i = keys.length - 1; i >= 0; i--) {
				var key = keys[i];

				if(userJSON[key]) {
					infoApproved.push([key, userJSON[key], dateForRequest]);
				}

				if(userJSON.syncronizedFields[key]) {
					userJSON.syncronizedFields[key].push(nodeUsername);
				} else {
					userJSON.syncronizedFields[key] = [nodeUsername];
				}
			};

			sendInfoToNode(nodeUsername, userIndex, infoApproved).then(function (result) {

				if(result) {

					//Ya se escribió, ahora eliminar de almacen personal de requests
					delete userJSON.requests[requestIndex];

					writeToChain(userIndex, JSON.stringify(userJSON)).then(function (res) {
						resolve("OK");
					}).catch((error) => {
						reject("ERROR");
					});
				} else {
					reject("ERROR");
				}
			});
		}).catch((error) => {
			reject(error);
		});

	});
}

router.post("/user/handleRequest", function(req, res, next) {
	console.log("user/handleRequest");
	var userIndex = req.body.userIndex;
	var userPassword = req.body.userPassword;
	var requestIndex = req.body.requestIndex;
	var keys = req.body.keys; // campos aceptados
	authenticateUser(userIndex, userPassword).then(function (response) {
		
		if(response) {
			handleRequest(userIndex, userPassword, requestIndex, keys).then(function (result) {

				res.send(result);
			});
			
		} else {
			res.send("Bad Login \n");
		}

	}).catch((error) => {
		res.send(error);
	});
});

router.post("/node/getUserInfo", function(req, res, next) {
	console.log("/node/getUserInfo");

	var nodeUsername = req.body.nodeUsername;
	var nodePassword = req.body.nodePassword;
	var userIndex = req.body.userIndex;

	readFromChain(nodeUsername+"-"+userIndex).then(function (response) {
		res.send(response);
	}).catch((error) => {
		res.send(error);
	});
})

module.exports = router;
