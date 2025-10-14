#!/bin/bash

mkdir -p backup

wrangler d1 export notebook-db --output backup/notebook-db-`date +%Y%m%d`.sql  --remote
