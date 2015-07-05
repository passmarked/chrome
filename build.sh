# make sure our build folder exists
mkdir -p builds/

# zips the current folder
zip -r builds/passmarked-chrome-extension-$(date +%Y%m%d%H%M%S).zip . -x *.git* -x *builds/*