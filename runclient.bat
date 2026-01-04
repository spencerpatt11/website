@echo off
setlocal

REM WEBSITE_URL MUST NOT END WITH "/"
set "WEBSITE_URL=https://www.radosrs.com"

set "SERVER_CACHE=%WEBSITE_URL%/cache.zip"
set "SERVER_CLIENT=%WEBSITE_URL%/client.zip"

set "LOCAL_CACHE=cache.zip"
set "LOCAL_CLIENT=client.zip"

set "SERVER_CACHE_VERSION=%WEBSITE_URL%/server_cache_version.txt"
set "SERVER_CLIENT_VERSION=%WEBSITE_URL%/server_client_version.txt"

set "LOCAL_CACHE_VERSION=local_cache_version.txt"
set "LOCAL_CLIENT_VERSION=local_client_version.txt"


:checkclient
    REM Download server client version.txt
    title Downloading server client version.txt
    echo Downloading server client version.txt
    curl --progress-bar "%SERVER_CLIENT_VERSION%" --output "server_client_version.txt"
    
    REM Check for existing client
    title Checking for existing client...
    
    if exist "Client/" (
        REM Client already exists, check for local client version.txt
        echo Existing client folder detected!
        
        if exist "%LOCAL_CLIENT_VERSION%" (
            REM Client exists and has a local client version.txt, download and compare server client version.txt against local client version.txt
            title Client found, checking for update...
            
            fc "server_client_version.txt" "%LOCAL_CLIENT_VERSION%" > nul
            
            if errorlevel 1 (
                REM Client and server versions DO NOT match.
                echo Client version mismatch, updating...
                goto :downloadclient
            ) else (
                REM Client and server versions DO match.
                echo Client version match, continuing...
                goto :checkcache
            )
        ) else (
            REM Client exists but has no local client version.txt, assume the client is outdated and force an update.
            echo Couldn't verify client version, updating...
            goto :downloadclient
        )
    ) else (
        REM Client does not exist, install it.
        echo Client not found, downloading...
        goto :downloadclient
    )


:downloadclient
    title Downloading client...
    echo Downloading client...
    curl --progress-bar "%SERVER_CLIENT%" --output "%LOCAL_CLIENT%"
    echo Client downloaded successfully!
    
    title Unzipping client...
    echo Unzipping client...
    tar -xf client.zip -C .
    
    ren "server_client_version.txt" "%LOCAL_CLIENT_VERSION%"
    goto :cleanupclient
    
   
:cleanupclient
    title Cleaning up...
    echo Cleaning up...
    echo Deleting unused client.zip...
    del %LOCAL_CLIENT%
    echo Deleting unused server_client_version.txt...
    del "server_client_version.txt"
    
    goto :checkcache   


:checkcache
    REM Download server cache version.txt
    title Downloading server cache version.txt
    echo Downloading server cache version.txt
    curl --progress-bar "%SERVER_CACHE_VERSION%" --output "server_cache_version.txt"
    
    REM Check for existing cache
    title Checking for existing cache...
    if exist "Client/cache/" (
        REM Cache already exists, check for local version.txt
        echo Existing cache folder detected!
        
        if exist "%LOCAL_CACHE_VERSION%" (
            REM Cache exists and has a local cache version.txt, download and compare server cache version.txt against local cache version.txt
            title Cache found, checking for update...
            
            fc "server_cache_version.txt" "%LOCAL_CACHE_VERSION%" > nul
            
            if errorlevel 1 (
                REM Client and server versions DO NOT match.
                echo Cache version mismatch, updating...
                goto :downloadcache
            ) else (
                REM Client and server versions DO match.
                echo Client is up-to-date!
                goto :start
            )
        ) else (
            REM Cache exists but has no local cache version.txt, assume the client is outdated and force an update.
            echo Couldn't verify cache version, updating...
            goto :downloadcache
        )
    ) else (
        REM Cache does not exist, install it.
        echo Cache not found, downloading...
        goto :downloadcache
    )


:downloadcache
    title Downloading cache...
    echo Downloading cache...
    curl --progress-bar "%SERVER_CACHE%" --output "%LOCAL_CACHE%"
    echo Cache downloaded successfully!
    
    title Unzipping cache...
    echo Unzipping cache...
    tar -xf cache.zip -C Client
    
    ren "server_cache_version.txt" "%LOCAL_CACHE_VERSION%"
    goto :cleanupcache
    
    
:cleanupcache
    title Cleaning up...
    echo Cleaning up...
    echo Deleting unused cache.zip...
    del %LOCAL_CACHE%
    echo Deleting unused server_cache_version.txt...
    del "server_cache_version.txt"
    
    goto :start
    
    
:start
    title Overloadx Client
    echo Starting Client...
    cd ./Client/
    "C:\Program Files\Java\jre-1.8\bin\java.exe" -Xmx2200m Launcher 30 0 lowmem members 32
    pause