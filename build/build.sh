STAGING="./staging"
PROJ="../"
SRC="$PROJ/src"
BIN="$PROJ/bin"
DTSLIBS="holochain-proto.d.ts shims.d.ts ex-array-shim.d.ts"
JSLIBS="$SRC/shims.js $SRC/ex-array-shim.js"


function allow {
  echo s:^/\\* $1://\\* $1:g
}
function block {
  echo s:^//\\* $1:/\\* $1:g
}


# compile js
tsc --project $SRC --outDir $STAGING
# compile dts
#tsc --project $SRC --declarations --declarationDir $BIN/dts --emitDeclarationOnly

# clean
sed "$STAGING/LinkRepo.js" -e "s:^require:// no. :g" -e "s:^exports\.:// no. :g" -e "s:^Object\.defineProperty.exports:// no. :g" > "$STAGING/_LinkRepo.js"

# glom
cat $JSLIBS "$STAGING/_LinkRepo.js" > "$BIN/LinkRepo.js"
