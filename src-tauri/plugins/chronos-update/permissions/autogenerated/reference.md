## Default Permission

Fetching the update manifest, and asking the system to install an APK. They
belong together and are useless apart: a manifest nothing may act on tells the
user about a version they cannot get, and an install with nothing to check
against has no version to install. The gate is not here — it is Android's own
installer screen, which the user has to agree to every time.

#### This default permission set includes the following:

- `allow-fetch-text`
- `allow-download-and-install`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`chronos-update:allow-download-and-install`

</td>
<td>

Enables the download_and_install command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`chronos-update:deny-download-and-install`

</td>
<td>

Denies the download_and_install command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`chronos-update:allow-fetch-text`

</td>
<td>

Enables the fetch_text command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`chronos-update:deny-fetch-text`

</td>
<td>

Denies the fetch_text command without any pre-configured scope.

</td>
</tr>
</table>
