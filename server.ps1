# PowerShell HTTP Server - Equivalent to server3.js
# Run with: powershell -ExecutionPolicy Bypass -File server.ps1

$PORT = 8000
$USERS_FILE = "users.json"

# Load users
$users = @{}
try {
    if (Test-Path $USERS_FILE) {
        $users = Get-Content $USERS_FILE | ConvertFrom-Json -AsHashtable
    }
} catch {
    $users = @{}
    $users | ConvertTo-Json | Out-File $USERS_FILE
}

function Save-Users {
    $users | ConvertTo-Json -Depth 10 | Out-File $USERS_FILE
}

function Send-Json($response, $data, $status = 200) {
    $response.StatusCode = $status
    $response.Headers.Add("Content-Type", "application/json")
    $content = [System.Text.Encoding]::UTF8.GetBytes(($data | ConvertTo-Json -Compress))
    $response.OutputStream.Write($content, 0, $content.Length)
    $response.Close()
}

function Send-File($response, $filename) {
    try {
        $content = Get-Content $filename -Raw -Encoding UTF8
        $response.StatusCode = 200
        $response.Headers.Add("Content-Type", "text/html")
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        Send-Json $response @{error = "File not found"} 404
    }
    $response.Close()
}

function Get-PostData($request) {
    $body = New-Object System.IO.StreamReader $request.InputStream
    $content = $body.ReadToEnd()
    $body.Close()
    try {
        return $content | ConvertFrom-Json
    } catch {
        return @{}
    }
}

function Test-Auth($request) {
    $user = $request.Headers["X-User"]
    $pass = $request.Headers["X-Pass"]
    
    if (-not $user -or -not $pass) {
        return $null
    }
    
    if (-not $users.ContainsKey($user) -or $users[$user].password -ne $pass) {
        return $null
    }
    
    return $users[$user]
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$PORT/")
$listener.Start()

Write-Host "Server running on http://localhost:$PORT"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    Write-Host "$($request.HttpMethod) $($request.Url.PathAndQuery)"
    
    $path = $request.Url.PathAndQuery
    
    if ($path -eq "/" -or $path -eq "/hub") {
        Send-File $response "hub.html"
    }
    elseif ($path -eq "/mines") {
        Send-File $response "mines.html"
    }
    elseif ($path -eq "/casino") {
        Send-File $response "hub.html"
    }
    elseif ($path -eq "/api/register" -and $request.HttpMethod -eq "POST") {
        $data = Get-PostData $request
        $username = $data.username
        $password = $data.password
        
        if (-not $username -or -not $password) {
            Send-Json $response @{error = "Missing fields"} 400
            continue
        }
        
        if ($users.ContainsKey($username)) {
            Send-Json $response @{error = "User exists"} 400
            continue
        }
        
        $users[$username] = @{
            password = $password
            balance = 1000
            activeGame = $null
            logouts = 0
        }
        
        Save-Users
        Send-Json $response @{message = "Registered"}
    }
    elseif ($path -eq "/api/login" -and $request.HttpMethod -eq "POST") {
        $data = Get-PostData $request
        $username = $data.username
        $password = $data.password
        
        if (-not $users.ContainsKey($username) -or $users[$username].password -ne $password) {
            Send-Json $response @{error = "Invalid login"} 401
            continue
        }
        
        Send-Json $response @{message = "Logged in"; balance = $users[$username].balance}
    }
    elseif ($path -eq "/api/logout" -and $request.HttpMethod -eq "POST") {
        $user = Test-Auth $request
        if ($user) {
            $user.logouts++
            Save-Users
        }
        Send-Json $response @{message = "Logged out"}
    }
    elseif ($path -eq "/api/balance" -and $request.HttpMethod -eq "GET") {
        $user = Test-Auth $request
        if (-not $user) {
            Send-Json $response @{error = "Invalid login"} 401
            continue
        }
        Send-Json $response @{balance = $user.balance}
    }
    elseif ($path -eq "/api/startGame" -and $request.HttpMethod -eq "POST") {
        $user = Test-Auth $request
        if (-not $user) {
            Send-Json $response @{error = "Invalid login"} 401
            continue
        }
        
        $data = Get-PostData $request
        $bet = [int]$data.bet
        $mines = [int]$data.mines
        
        if ($bet -le 0 -or $bet -gt $user.balance) {
            Send-Json $response @{error = "Invalid bet"} 400
            continue
        }
        
        $user.balance -= $bet
        
        $minePositions = @()
        $random = New-Object System.Random
        while ($minePositions.Count -lt $mines) {
            $pos = $random.Next(0, 25)
            if ($pos -notin $minePositions) {
                $minePositions += $pos
            }
        }
        
        $user.activeGame = @{
            bet = $bet
            mines = $mines
            minePositions = $minePositions
            revealed = @()
            currentProfit = 0
        }
        
        Save-Users
        Send-Json $response @{balance = $user.balance}
    }
    elseif ($path -eq "/api/reveal" -and $request.HttpMethod -eq "POST") {
        $user = Test-Auth $request
        if (-not $user) {
            Send-Json $response @{error = "Invalid login"} 401
            continue
        }
        
        if (-not $user.activeGame) {
            Send-Json $response @{error = "No active game"} 400
            continue
        }
        
        $data = Get-PostData $request
        $index = [int]$data.index
        
        if ($index -in $user.activeGame.minePositions) {
            $minePositions = $user.activeGame.minePositions
            $user.activeGame = $null
            Save-Users
            Send-Json $response @{hitMine = $true; balance = $user.balance; minePositions = $minePositions}
            continue
        }
        
        if ($index -notin $user.activeGame.revealed) {
            $user.activeGame.revealed += $index
        }
        
        $user.activeGame.currentProfit = [Math]::Round($user.activeGame.bet * (1 + $user.activeGame.revealed.Count * 0.25))
        
        Save-Users
        Send-Json $response @{
            hitMine = $false
            currentProfit = $user.activeGame.currentProfit
            balance = $user.balance
        }
    }
    elseif ($path -eq "/api/cashout" -and $request.HttpMethod -eq "POST") {
        $user = Test-Auth $request
        if (-not $user) {
            Send-Json $response @{error = "Invalid login"} 401
            continue
        }
        
        if (-not $user.activeGame) {
            Send-Json $response @{error = "No active game"} 400
            continue
        }
        
        $user.balance += $user.activeGame.currentProfit
        $won = $user.activeGame.currentProfit
        
        $user.activeGame = $null
        Save-Users
        
        Send-Json $response @{balance = $user.balance; wonAmount = $won}
    }
    else {
        Send-Json $response @{error = "Not found"} 404
    }
}

$listener.Stop()
