# sisp_store — optional SQLite history store. Kept out of libsisp so the core stays
# dependency-free; disable with -DSISP_BUILD_STORE=OFF.
include(${CMAKE_CURRENT_SOURCE_DIR}/embed_sql.cmake)
sisp_store_embed_sql(${CMAKE_CURRENT_BINARY_DIR}/generated/sisp_store_sql.h)

find_package(Threads REQUIRED)

# Vendored SQLite amalgamation (public domain). Compiled with its own flags, warnings off:
# it is third-party code and is not held to libsisp's -Werror policy.
add_library(sisp_sqlite3 OBJECT vendor/sqlite/sqlite3.c)
set_target_properties(sisp_sqlite3 PROPERTIES POSITION_INDEPENDENT_CODE ON C_VISIBILITY_PRESET hidden)
target_compile_definitions(sisp_sqlite3 PUBLIC
  SQLITE_DQS=0
  SQLITE_DEFAULT_FOREIGN_KEYS=1
  SQLITE_DEFAULT_MEMSTATUS=0
  SQLITE_LIKE_DOESNT_MATCH_BLOBS
  SQLITE_OMIT_DEPRECATED
  SQLITE_OMIT_LOAD_EXTENSION
  SQLITE_OMIT_SHARED_CACHE
  SQLITE_THREADSAFE=1
  SQLITE_API=)
if(MSVC)
  target_compile_options(sisp_sqlite3 PRIVATE /w)
else()
  # -fno-sanitize=undefined: UBSan reports in vendored SQLite are not ours to fix (ASan still applies)
  target_compile_options(sisp_sqlite3 PRIVATE -w -fno-sanitize=undefined)
endif()

add_library(sisp_store STATIC src/sisp_store.c $<TARGET_OBJECTS:sisp_sqlite3>)
add_library(sisp::sisp_store ALIAS sisp_store)
set_target_properties(sisp_store PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_include_directories(sisp_store
  PUBLIC $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include> $<INSTALL_INTERFACE:include>
  PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/vendor/sqlite ${CMAKE_CURRENT_BINARY_DIR}/generated)
target_compile_definitions(sisp_store PRIVATE SQLITE_API= SISP_STORE_BUILDING)
target_compile_options(sisp_store PRIVATE ${SISP_WARNINGS})
# Plain flags (not Threads::Threads) so the exported sispConfig.cmake needs no find_dependency.
target_link_libraries(sisp_store PUBLIC sisp_static ${CMAKE_THREAD_LIBS_INIT} ${CMAKE_DL_LIBS})

if(SISP_BUILD_EXAMPLES)
  add_executable(sisp-store examples/sisp_store_cli.c)
  target_link_libraries(sisp-store PRIVATE sisp_store)
  target_compile_options(sisp-store PRIVATE ${SISP_WARNINGS})
endif()

if(SISP_BUILD_TESTS)
  add_executable(test_store tests/test_store.c)
  target_link_libraries(test_store PRIVATE sisp_store)
  target_include_directories(test_store PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/vendor/sqlite)
  target_compile_options(test_store PRIVATE ${SISP_WARNINGS})
  add_test(NAME store COMMAND test_store ${CMAKE_CURRENT_BINARY_DIR}/test-store.db)
endif()

install(TARGETS sisp_store EXPORT sispTargets ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR})
install(FILES include/sisp_store.h DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
