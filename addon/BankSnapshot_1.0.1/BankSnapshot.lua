local addonName, addonTable = ...

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:RegisterEvent("PLAYER_LOGIN") -- NEU: Garantiert geladene Serverdaten beim Start
frame:RegisterEvent("PLAYER_LOGOUT")
frame:RegisterEvent("BANKFRAME_OPENED")
frame:RegisterEvent("BANKFRAME_CLOSED")
frame:RegisterEvent("PLAYERBANKSLOTS_CHANGED")

local isBankOpen = false

-- Hilfsfunktion: Prüft, ob eine Taschen-ID zur Kriegsmeilen-Bank gehört
local function IsWarbandBagID(bagID)
    if C_Bank and C_Bank.FetchPurchasedBankTabIDs then
        local warbandTabIDs = C_Bank.FetchPurchasedBankTabIDs(Enum.BankType.Account)
        if warbandTabIDs then
            for _, id in ipairs(warbandTabIDs) do
                if id == bagID then return true end
            end
        end
    end
    return false
end

-- Taschen scannen (Charakter-Taschen oder Charakter-Bank)
local function ScanCharacterBagsOrBank(isBank)
    local data = {}
    local startBag = isBank and -1 or 0
    local endBag = isBank and 12 or 4

    for bag = startBag, endBag do
        local isValidCharBag = (not isBank and (bag >= 0 and bag <= 4)) or 
                               (isBank and (bag == -1 or (bag >= 6 and bag <= 12)))

        if isValidCharBag and not IsWarbandBagID(bag) then
            if C_Container and C_Container.GetContainerNumSlots then
                local slots = C_Container.GetContainerNumSlots(bag)
                for slot = 1, slots do
                    local itemInfo = C_Container.GetContainerItemInfo(bag, slot)
                    if itemInfo then
                        local itemID = itemInfo.itemID
                        local stackCount = itemInfo.stackCount
                        if itemID and stackCount then
                            data[tostring(itemID)] = (data[tostring(itemID)] or 0) + stackCount
                        end
                    end
                end
            end
        end
    end
    return data
end

-- Reine Kriegsmeilen-Bank (Warband) scannen
local function ScanWarbandBankOnly()
    local data = {}
    if C_Bank and C_Bank.FetchPurchasedBankTabIDs then
        local warbandTabIDs = C_Bank.FetchPurchasedBankTabIDs(Enum.BankType.Account)
        if warbandTabIDs then
            for _, tabID in ipairs(warbandTabIDs) do
                local slots = C_Container.GetContainerNumSlots(tabID)
                for slot = 1, slots do
                    local itemInfo = C_Container.GetContainerItemInfo(tabID, slot)
                    if itemInfo then
                        local itemID = itemInfo.itemID
                        local stackCount = itemInfo.stackCount
                        if itemID and stackCount then
                            data[tostring(itemID)] = (data[tostring(itemID)] or 0) + stackCount
                        end
                    end
                end
            end
        end
    end
    return data
end

-- HAUPTFUNKTION ZUM SPEICHERN (DIREKT ABSICHERUNG GEGEN 0-BUG BEI LOGOUT/RELOAD)
local function SaveAllData(isInitialBoot)
    if not BankSnapshotDB then return end

    local charName = UnitName("player")
    local realmName = GetRealmName()
    if not charName or not realmName then return end

    -- Tabellenstrukturen absichern
    if not BankSnapshotDB.realms then BankSnapshotDB.realms = {} end
    if not BankSnapshotDB.warband then BankSnapshotDB.warband = {} end
    if not BankSnapshotDB.names then BankSnapshotDB.names = {} end
    if not BankSnapshotDB.realms[realmName] then BankSnapshotDB.realms[realmName] = {} end
    
    -- Lese vorherigen Goldbestand aus der Datei
    local oldGold = 0
    if BankSnapshotDB.realms[realmName][charName] and BankSnapshotDB.realms[realmName][charName].gold then
        oldGold = BankSnapshotDB.realms[realmName][charName].gold
    end

    if not BankSnapshotDB.realms[realmName][charName] then 
        BankSnapshotDB.realms[realmName][charName] = { bags = {}, bank = {}, gold = 0 } 
    end

    -- Holt das aktuelle Gold live von der API
    local currentGold = GetMoney()

    -- RADIKALER FILTER: Wenn das Spiel beim Abmelden/Neuladen eine fälschliche 0 meldet, 
    -- blockiere das Überschreiben und rette das existierende Vermögen!
    if currentGold == 0 and oldGold > 0 then
        BankSnapshotDB.realms[realmName][charName].gold = oldGold
    else
        -- Nur zuweisen, wenn es kein fehlerhafter Boot-Nullwert vor PLAYER_LOGIN ist
        if not (currentGold == 0 and isInitialBoot) then
            BankSnapshotDB.realms[realmName][charName].gold = currentGold
        end
    end

    -- Inventar-Scan ausführen
    BankSnapshotDB.realms[realmName][charName].bags = ScanCharacterBagsOrBank(false)

    if isBankOpen then
        BankSnapshotDB.realms[realmName][charName].bank = ScanCharacterBagsOrBank(true)
        local freshWarband = ScanWarbandBankOnly()
        if freshWarband and next(freshWarband) ~= nil then
            BankSnapshotDB.warband = freshWarband
        end
    end

    -- Namen-Cache befüllen
    local function CacheNames(targetTable)
        if not targetTable then return end
        for itemIDStr, _ in pairs(targetTable) do
            local itemID = tonumber(itemIDStr)
            if itemID and C_Item and C_Item.GetItemNameByID then
                local name = C_Item.GetItemNameByID(itemID)
                if name then BankSnapshotDB.names[itemIDStr] = name end
            end
        end
    end

    CacheNames(BankSnapshotDB.realms[realmName][charName].bags)
    CacheNames(BankSnapshotDB.realms[realmName][charName].bank)
    CacheNames(BankSnapshotDB.warband)
end

-- EVENT-STEUERUNG
frame:SetScript("OnEvent", function(self, event, arg1)
    if event == "ADDON_LOADED" and arg1 == addonName then
        if not BankSnapshotDB then
            BankSnapshotDB = { realms = {}, warband = {}, names = {} }
        end
        -- ADDON_LOADED: Datenstruktur bereitmachen, aber Goldabfrage noch blockieren (InitialBoot = true)
        SaveAllData(true)
        
    elseif event == "PLAYER_LOGIN" then
        -- PLAYER_LOGIN: Welt geladen! GetMoney() liefert jetzt 100% korrekte Daten.
        SaveAllData(false)
        
    elseif event == "BANKFRAME_OPENED" then
        isBankOpen = true
        SaveAllData(false)
        
    elseif event == "BANKFRAME_CLOSED" then
        SaveAllData(false)
        isBankOpen = false
        
    elseif event == "PLAYERBANKSLOTS_CHANGED" then
        if isBankOpen then SaveAllData(false) end
        
    elseif event == "PLAYER_LOGOUT" then
        SaveAllData(false)
    end
end)