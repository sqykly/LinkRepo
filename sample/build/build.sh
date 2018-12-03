STAGING="./staging"
PROJ="../test-system"
SRCZOME="$PROJ/dna/repo"
SRCUI="$PROJ/ui"
LIBSRC="../../src"
BIN="../../bin/LinkRepo"
BINZOME="$BIN/dna/repo"
BINUI="$BIN/ui"
LIBS="holochain-proto.d.ts shims.d.ts ex-array-shim.d.ts"

# gather
for lib in $LIBS; do
  cp $LIBSRC/$lib $SRCZOME
done

# compile
tsc --project $SRCZOME --outDir $STAGING

# clean
sed "$STAGING/repo.js" -e "s:^require:// no. :g" -e "s:^exports\.:// no. :g" -e "s:^Object\.defineProperty.exports:// no. :g" > "$STAGING/_repo.js"

# glom
cat "$LIBSRC/shims.js" "$LIBSRC/ex-array-shim.js" "$STAGING/_repo.js" > "$BINZOME/repo.js"

# UI
cp -r $SRCUI $BIN
