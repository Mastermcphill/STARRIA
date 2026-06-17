"""search-core — content search, indexing, and recommendation engine.

Extracted from Vidzi's discovery router. Provides a SQL-backed content index
with a pluggable interface so Elasticsearch or Typesense can be swapped in
without changing the router layer.
"""
__version__ = "0.1.0"
