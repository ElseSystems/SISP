# Runs `sisp-cli assess < checkins.csv` and checks the space-fever finding.
execute_process(COMMAND ${CLI} assess INPUT_FILE ${CSV} OUTPUT_VARIABLE out RESULT_VARIABLE rc)
message(STATUS "${out}")
if(NOT rc EQUAL 3)
  message(FATAL_ERROR "expected exit code 3 (N2+), got ${rc}")
endif()
if(NOT out MATCHES "\"temperature\": {\"severity\": \"N2\"")
  message(FATAL_ERROR "expected temperature N2 (space fever vs in-flight baseline)")
endif()
