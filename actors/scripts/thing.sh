curl -i -X PUT -u ditto:ditto -H 'Content-Type: application/json' --data '{
  "features": {
    "_actor": {
      "properties": {
        "state": {"value": "on"}
      }
    },
    "status": {
      "properties": {
        "power": {
            "value": "off"
        },
        "aqi": {
            "value": 0
        },
        "led": {
            "value": "on"
        }
      }
    }
  }
}' http://localhost:32747/api/2/things/org.i2ec:air-purifier
