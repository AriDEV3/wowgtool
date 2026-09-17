local addonName, addonTable = ...

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
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

-- 1. CHARAKTER-TASCHEN ODER NORMALE BANK SCANNEN
local function ScanCharacterBagsOrBank(isBank)
    local data = {}
    -- Taschen: 0 bis 4 | Charakter-Bank: -1 und 6 bis 12
    local startBag = isBank and -1 or 0
    local endBag = isBank and 12 or 4

    for bag = startBag, endBag do
        -- Falls wir die Bank scannen, stellen wir sicher, dass es KEIN Warband-Tab ist!
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

-- 2. REINE KRIEGSMEILEN-BANK (WARBAND) SCANNEN
local function ScanWarbandBankOnly()
    local data = {}
    
    if C_Bank and C_Bank.FetchPurchasedBankTabIDs then
        -- Holt die exakten IDs aller freigeschalteten Kriegsmeilen-Tabs
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

-- HAUPTFUNKTION ZUM SPEICHERN
local function SaveAllData()
    if not BankSnapshotDB then return end

    local charName = UnitName("player")
    local realmName = GetRealmName()
    if not charName or not realmName then return end

    -- Struktur-Schutz initialisieren
    if not BankSnapshotDB.realms then BankSnapshotDB.realms = {} end
    if not BankSnapshotDB.warband then BankSnapshotDB.warband = {} end
    if not BankSnapshotDB.names then BankSnapshotDB.names = {} end
    if not BankSnapshotDB.realms[realmName] then BankSnapshotDB.realms[realmName] = {} end
    if not BankSnapshotDB.realms[realmName][charName] then 
        BankSnapshotDB.realms[realmName][charName] = { bags = {}, bank = {} } 
    end

    -- 1. Taschen (Immer aktuell scannen)
    BankSnapshotDB.realms[realmName][charName].bags = ScanCharacterBagsOrBank(false)

    -- 2. Banken (Nur aktualisieren, wenn das Bankier-Fenster offen ist!)
    if isBankOpen then
        -- Speichert NUR Charakter-Bank-Items (Warband-Filter greift hier)
        BankSnapshotDB.realms[realmName][charName].bank = ScanCharacterBagsOrBank(true)
        
        -- Speichert die Warband-Items isoliert ab auf oberster Ebene
        local freshWarband = ScanWarbandBankOnly()
        if freshWarband and next(freshWarband) ~= nil then
            BankSnapshotDB.warband = freshWarband
        end
    end

    -- 3. Namen-Cache aktualisieren (Für Electron)
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
    elseif event == "BANKFRAME_OPENED" then
        isBankOpen = true
        SaveAllData()
    elseif event == "BANKFRAME_CLOSED" then
        SaveAllData()
        isBankOpen = false
    elseif event == "PLAYERBANKSLOTS_CHANGED" then
        if isBankOpen then SaveAllData() end
    elseif event == "PLAYER_LOGOUT" then
        SaveAllData()
    end
end)