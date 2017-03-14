/*
Copyright IBM Corp. 2016 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"errors"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
)

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}
var EVENT_COUNTER = "event_counter"
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface, function string, args []string) ([]byte, error) {
	//No es necesario colocar informacion en el Ledger durante la inicializacion, sin embargo nos sirve como forma
	//de validacion de que el chaincode se cargo de forma correcta con una persona dummy.
	var idPersona string // ID de la persona
	var datosPersona string // Datos de la Persona
	var err error
	
	//Se espera que vengan dos valores
	if len(args) != 2 {
		return nil, errors.New("Cantidad de argumentos invalida. Se esperan 2.")
	}

	//Obtenemos el id de la persona que viene en la posicion cero de los argumentos.
	idPersona = args[0]
	datosPersona = args[1]	

	// Escribimos la persona en el Ledger
	err = stub.PutState(idPersona, []byte(datosPersona))
	if err != nil {
		return nil, err
	}

	//Generamos el texto que se va mostrar en la columna Payload del Blockchain.
	fmt.Printf("Se cargo la persona con idPersona = %v, y datosPersona = %v\n", idPersona, datosPersona)
	
	return nil, nil
}

//Funcion Invoke para escribir o modificar informacion en el Ledger
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface, function string, args []string) ([]byte, error) {
	var idPersona string // ID de la persona
	var datosPersona string // Datos de la Persona
	var err error

	if function == "nuevo" {
		if len(args) != 2 {
			return nil, errors.New("Cantidad de argumentos invalida. Se esperan 2.")
		}
		
		//Obtenemos el id de la persona que viene en la posicion cero de los argumentos.
		idPersona = args[0]
		datosPersona = args[1]
		
		// Escribimos la persona en el Ledger
		err = stub.PutState(idPersona, []byte(datosPersona))
		if err != nil {
			return nil, err
		}
	
		//Generamos el texto que se va mostrar en la columna Payload del Blockchain.
		fmt.Printf("Nueva persona con idPersona = %v, y datosPersona = %v\n", idPersona, datosPersona)
	}
	
	//Implementar la funcion "modifica"
	if function == "modifica" {
			
	}

	return nil, nil
}

// Elimina una persona del Ledger
func (t *SimpleChaincode) delete(stub shim.ChaincodeStubInterface, args []string) ([]byte, error) {
	if len(args) != 1 {
		return nil, errors.New("Cantidad de argumentos invalida. Se esperan 1.")
	}

	idPersona := args[0]

	// Eliminamos la persona del Ledger
	err := stub.DelState(idPersona)
	if err != nil {
		return nil, errors.New("No se pudo eliminar a la persona")
	}

	return nil, nil
}

// Consulta de personas
func (t *SimpleChaincode) Query(stub shim.ChaincodeStubInterface, function string, args []string) ([]byte, error) {
	
	var idPersona string // Id de la persona a consultar
	var err error

	if len(args) != 1 {
		return nil, errors.New("Cantidad de argumentos invalida. Se esperan 1.")
	}

	idPersona = args[0]

	// Obtenemos a la persona del Ledger
	datosPersonaBytes, err := stub.GetState(idPersona)
	if err != nil {
		jsonResp := "{\"Error\":\"No se pudo obtener la persona " + idPersona + "\"}"
		return nil, errors.New(jsonResp)
	}

	if datosPersonaBytes == nil {
		jsonResp := "{\"Error\":\"No existen datos para la persona " + idPersona + "\"}"
		return nil, errors.New(jsonResp)
	}

	jsonResp := string(datosPersonaBytes)
	fmt.Printf("Respuesta de la consulta:%s\n", jsonResp)
	return datosPersonaBytes, nil
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
